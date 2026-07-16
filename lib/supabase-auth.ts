/**
 * Server-side auth utilities for API routes.
 * Creates a Supabase client from cookies and verifies the session.
 */

import { createClient } from '@supabase/supabase-js';
import { credentials } from '@/lib/credentials';
import { parseSupabaseConfig } from '@/lib/supabase-config-parser';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { SupabaseConfig } from '@/types';

interface AuthResult {
  user: User;
  client: SupabaseClient;
}

/**
 * Get the authenticated user and Supabase client from request cookies.
 * Returns null if not authenticated or Supabase is not configured.
 */
export async function getAuthUser(): Promise<AuthResult | null> {
  try {
    const config = await credentials.get<SupabaseConfig>('supabase_config');
    if (!config) return null;

    const parsed = parseSupabaseConfig(config);

    // NO-AUTH mode (self-hosted "Creatives" — no login screen, no auto-login).
    // Every request is treated as a single default owner, using a service-role
    // client that bypasses RLS so the builder works without any authentication.
    const client = createClient(parsed.projectUrl, config.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const user = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'creatives@foundreach.local',
      app_metadata: { role: 'owner', provider: 'noauth' },
      user_metadata: {},
      aud: 'authenticated',
      role: 'authenticated',
      created_at: new Date(0).toISOString(),
    } as unknown as User;

    return { user, client: client as unknown as SupabaseClient };
  } catch {
    return null;
  }
}
