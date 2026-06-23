'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { getLayerName } from '@/lib/layer-display-utils';
import { findLayerById } from '@/lib/layer-utils';
import { cn } from '@/lib/utils';
import { useAiChatStore } from '@/stores/useAiChatStore';
import type { ChatMessage, SelectedLayerRef } from '@/stores/useAiChatStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';

import { toolCallLabel } from './ai-tool-labels';

const SUGGESTIONS = [
  'Add a hero section with a headline and a call to action',
  'Create a 3-column features section',
  'Add a contact form at the bottom of this page',
];

interface AiChatPanelProps {
  embedded?: boolean;
}

export default function AiChatPanel({ embedded = false }: AiChatPanelProps) {
  const messages = useAiChatStore((s) => s.messages);
  const status = useAiChatStore((s) => s.status);
  const error = useAiChatStore((s) => s.error);
  const sendMessage = useAiChatStore((s) => s.sendMessage);
  const stop = useAiChatStore((s) => s.stop);
  const clear = useAiChatStore((s) => s.clear);
  const close = useAiChatStore((s) => s.close);

  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds);
  const currentPageId = useEditorStore((s) => s.currentPageId);
  const draftLayers = usePagesStore((s) =>
    currentPageId ? s.draftsByPageId[currentPageId]?.layers : undefined,
  );

  const [input, setInput] = useState('');
  const [contextDetached, setContextDetached] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isStreaming = status === 'streaming';

  const selectedRefs = useMemo<SelectedLayerRef[]>(() => {
    if (!selectedLayerIds.length || !draftLayers) return [];
    return selectedLayerIds
      .map((id) => {
        const layer = findLayerById(draftLayers, id);
        return layer ? { id, name: getLayerName(layer) } : null;
      })
      .filter((ref): ref is SelectedLayerRef => ref !== null);
  }, [selectedLayerIds, draftLayers]);

  // A fresh selection re-attaches context that the user previously dismissed.
  useEffect(() => {
    setContextDetached(false);
  }, [selectedLayerIds]);

  const attachedRefs = contextDetached ? [] : selectedRefs;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const submit = (text: string) => {
    if (!text.trim() || isStreaming) return;
    setInput('');
    void sendMessage(text, { selectedLayers: attachedRefs });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit(input);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden',
        embedded
          ? 'flex-1 min-h-0'
          : 'w-80 shrink-0 bg-background border-l h-full',
      )}
    >
      {embedded ? (
        <div className="flex items-center justify-end px-4 pt-3 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="size-7 p-0"
            onClick={clear}
            disabled={messages.length === 0}
            aria-label="New chat"
            title="New chat"
          >
            <Icon name="plus" className="size-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 h-12 shrink-0 border-b">
          <div className="flex items-center gap-2">
            <Icon name="sparkles" className="size-3.5 text-foreground" />
            <span className="text-xs font-medium">AI</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="size-7 p-0"
              onClick={clear}
              disabled={messages.length === 0}
              aria-label="New chat"
              title="New chat"
            >
              <Icon name="plus" className="size-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="size-7 p-0"
              onClick={close}
              aria-label="Close AI panel"
              title="Close"
            >
              <Icon name="x" className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 flex flex-col gap-4">
        {messages.length === 0 ? (
          <EmptyState onPick={submit} disabled={isStreaming} />
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id} message={message}
              isStreaming={isStreaming}
            />
          ))
        )}

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>

      <div className="border-t p-3 shrink-0">
        {attachedRefs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mb-2">
            {attachedRefs.map((ref) => (
              <span
                key={ref.id}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground max-w-[160px]"
              >
                <Icon name="layers" className="size-3 shrink-0" />
                <span className="truncate">{ref.name}</span>
              </span>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="size-5 p-0 text-muted-foreground"
              onClick={() => setContextDetached(true)}
              aria-label="Remove selection context"
              title="Remove selection context"
            >
              <Icon name="x" className="size-3" />
            </Button>
          </div>
        )}
        <div className="relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI to build or edit your page..."
            rows={2}
            className="pr-10 resize-none"
          />
          <div className="absolute right-2 bottom-2">
            {isStreaming ? (
              <Button
                size="sm" variant="secondary"
                className="size-7 p-0" onClick={stop}
                aria-label="Stop"
              >
                <Icon name="stop" className="size-3" />
              </Button>
            ) : (
              <Button
                size="sm"
                className="size-7 p-0"
                onClick={() => submit(input)}
                disabled={!input.trim()}
                aria-label="Send"
              >
                <Icon name="arrowLeft" className="size-3.5 rotate-90" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick, disabled }: { onPick: (text: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col gap-3 mt-2">
      <p className="text-xs text-muted-foreground">
        Describe what you want to build. The AI can create sections, edit elements, manage content, and more.
      </p>
      <div className="flex flex-col gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onPick(suggestion)}
            className="text-left text-xs rounded-lg border bg-muted/40 hover:bg-muted px-3 py-2 transition-colors disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message, isStreaming }: { message: ChatMessage; isStreaming: boolean }) {
  if (message.role === 'user') {
    return (
      <div className="self-end max-w-[85%] rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs whitespace-pre-wrap break-words">
        {message.text}
      </div>
    );
  }

  const isEmpty = !message.text && message.toolCalls.length === 0;

  return (
    <div className="flex flex-col gap-2">
      {message.toolCalls.length > 0 && (
        <div className="flex flex-col gap-1">
          {message.toolCalls.map((call) => (
            <div key={call.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              {call.ok === undefined ? (
                <Spinner className="size-3" />
              ) : (
                <Icon
                  name={call.ok ? 'check' : 'x'}
                  className={cn('size-3', call.ok ? 'text-foreground' : 'text-destructive')}
                />
              )}
              <span>{toolCallLabel(call.name)}</span>
            </div>
          ))}
        </div>
      )}

      {message.text && (
        <div className="text-xs leading-relaxed whitespace-pre-wrap break-words">{message.text}</div>
      )}

      {isEmpty && isStreaming && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner className="size-3" />
          <span>Thinking...</span>
        </div>
      )}
    </div>
  );
}
