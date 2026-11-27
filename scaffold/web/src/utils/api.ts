import type { Conversation, UserSession } from '../types/inbox';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Request failed (${res.status})`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}

export const api = {
  getMe: () => requestJson<UserSession>('/api/me'),

  logout: () => requestJson<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  getConversations: (workspace: string) =>
    requestJson<Conversation[]>(`/api/conversations?workspace=${encodeURIComponent(workspace)}`),

  claimConversation: (workspace: string, contact: string) =>
    requestJson<{ ok: boolean; assignee: string }>(
      `/api/conversations/${encodeURIComponent(contact)}/claim`,
      {
        method: 'POST',
        body: JSON.stringify({ workspace }),
      }
    ),

  releaseConversation: (workspace: string, contact: string) =>
    requestJson<{ ok: boolean; assignee: null }>(
      `/api/conversations/${encodeURIComponent(contact)}/release`,
      {
        method: 'POST',
        body: JSON.stringify({ workspace }),
      }
    ),

  updateStatus: (workspace: string, contact: string, status: 'open' | 'closed') =>
    requestJson<{ ok: boolean; status: 'open' | 'closed' }>(
      `/api/conversations/${encodeURIComponent(contact)}/status`,
      {
        method: 'POST',
        body: JSON.stringify({ workspace, status }),
      }
    ),

  sendReply: (workspace: string, contact: string, text: string, client_ref: string) =>
    requestJson<{ ok: boolean; client_ref: string; status: string }>(
      `/api/conversations/${encodeURIComponent(contact)}/reply`,
      {
        method: 'POST',
        body: JSON.stringify({ workspace, text, client_ref }),
      }
    ),
};
