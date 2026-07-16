/**
 * AI copilot for the editor. Gives the chat panel full control of the document
 * by REUSING the project's own MCP tools (createMcpServer) in-process — the same
 * tools Cursor/Claude use to edit a Ycode site — driven by an LLM (OpenRouter).
 * Nothing is re-implemented: the AI calls add_layer / update_layer_text /
 * update_layer_design / update_layer_image / ... exactly as the MCP server defines them.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '@/lib/mcp/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Provider-agnostic (any OpenAI-compatible chat endpoint): OpenRouter, Groq,
// OpenAI, or the user's own key. Configure via AI_API_URL / AI_API_KEY / AI_MODEL,
// falling back to the OPENROUTER_* vars.
const API_URL =
  (process.env.AI_API_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '') + '/chat/completions';
const MODEL = process.env.AI_MODEL || process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';
const MAX_STEPS = 24;

type ChatMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: any[]; tool_call_id?: string; name?: string };

// MCP JSON-schema tool -> OpenAI/OpenRouter function tool
function toOpenAITool(t: { name: string; description?: string; inputSchema?: any }) {
  return {
    type: 'function' as const,
    function: {
      name: t.name,
      description: (t.description || '').slice(0, 1024),
      parameters: t.inputSchema && t.inputSchema.type ? t.inputSchema : { type: 'object', properties: {} },
    },
  };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI is not configured (missing AI_API_KEY / OPENROUTER_API_KEY).' }, { status: 400 });
  }

  let body: { messages?: { role: string; content: string }[]; page_id?: string; selected_layer_id?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const { messages = [], page_id, selected_layer_id } = body;
  if (!page_id) return NextResponse.json({ error: 'page_id is required.' }, { status: 400 });

  // Spin up the project's own MCP server in-process and talk to it via a linked
  // in-memory transport. This reuses every registered editing tool, unmodified.
  const server = createMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'ycode-editor-ai', version: '1.0.0' }, { capabilities: {} });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    // Curated, essential editing tools only. The full MCP toolset (20+ tools) is
    // ~40k tokens of schema per request — too heavy. This focused set covers the
    // "carte blanche" (structure, text, images, design/sizes/colors, links) while
    // keeping each request small enough for any model/quota.
    const ALLOW = new Set(
      (process.env.AI_TOOLS ||
        'list_pages,get_page,add_layer,delete_layer,move_layer,update_layer_text,update_text,set_rich_text_content,update_layer_design,update_layer_image,update_layer_background_image,update_layer_link,update_layer_settings')
        .split(',').map((s) => s.trim()),
    );
    const { tools: mcpTools } = await client.listTools();
    const tools = mcpTools.filter((t) => ALLOW.has(t.name)).map(toOpenAITool);

    const system = [
      'You are the built-in AI design copilot inside the Ycode visual website editor.',
      'You have FULL control (carte blanche) of the current page through the provided tools:',
      'you can add/delete/move layers, edit text, set images and backgrounds, and adjust the',
      'visual design (sizes, spacing, colors, layout, typography) via update_layer_design.',
      '',
      `The user is editing page_id="${page_id}".`,
      selected_layer_id ? `The currently selected layer is "${selected_layer_id}".` : 'No layer is selected.',
      '',
      'ALWAYS begin by calling get_page (with this page_id) to see the current layer tree and ids',
      'before making changes. Use the real layer ids from get_page. Apply the change with the',
      'right tools, then briefly tell the user what you changed. Prefer update_layer_design for',
      'sizing/spacing/color/layout. Keep going until the request is fully done. Be decisive.',
    ].join('\n');

    const convo: ChatMessage[] = [
      { role: 'system', content: system },
      ...messages.map((m) => ({ role: m.role as ChatMessage['role'], content: m.content })),
    ];

    let edited = false;
    let finalText = '';

    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ycode-production-04b7.up.railway.app',
          'X-Title': 'Ycode Editor AI',
        },
        body: JSON.stringify({ model: MODEL, messages: convo, tools, tool_choice: 'auto', temperature: 0.2 }),
      });
      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({ error: `AI provider error: ${res.status} ${errText.slice(0, 300)}` }, { status: 502 });
      }
      const data = await res.json();
      const choice = data.choices?.[0]?.message;
      if (!choice) return NextResponse.json({ error: 'Empty AI response.' }, { status: 502 });

      convo.push({ role: 'assistant', content: choice.content ?? '', tool_calls: choice.tool_calls });

      if (choice.tool_calls && choice.tool_calls.length > 0) {
        for (const call of choice.tool_calls) {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(call.function.arguments || '{}'); } catch { /* ignore */ }
          let resultText: string;
          try {
            const result = await client.callTool({ name: call.function.name, arguments: args });
            const content = (result?.content as any[]) || [];
            resultText = content.map((c) => (c.type === 'text' ? c.text : JSON.stringify(c))).join('\n') || 'ok';
            if (!/^get_page$|^list_pages$/.test(call.function.name) && !result?.isError) edited = true;
          } catch (e) {
            resultText = `Error executing ${call.function.name}: ${e instanceof Error ? e.message : String(e)}`;
          }
          convo.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: resultText });
        }
        continue; // let the model react to tool results
      }

      finalText = choice.content || '';
      break;
    }

    return NextResponse.json({ message: finalText || 'Done.', edited });
  } finally {
    try { await client.close(); } catch { /* noop */ }
    try { await server.close(); } catch { /* noop */ }
  }
}
