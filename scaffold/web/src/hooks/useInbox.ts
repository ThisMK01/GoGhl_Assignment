import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';
import { useWorkspaceSocket } from './useWorkspaceSocket';
import type {
  Conversation,
  MessageItem,
  QueueFilter,
  WsEvent,
} from '../types/inbox';

export function useInbox(workspace: string, currentSub: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [search, setSearch] = useState('');
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    if (!workspace) {
      setConversations([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await api.getConversations(workspace);
      setConversations(list);
      setSelectedContact((prev) => {
        if (prev && list.some((c) => c.contact === prev)) return prev;
        return list[0]?.contact ?? null;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleWsEvent = useCallback(
    (evt: WsEvent) => {
      if (!evt.contact) return;

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.contact === evt.contact);
        const nowIso = evt.occurred_at || new Date().toISOString();

        if (evt.type === 'message.inbound') {
          const newMsg: MessageItem = {
            id: evt.message_id || `in_${evt.seq}`,
            direction: 'inbound',
            text: evt.text || '',
            occurred_at: nowIso,
          };

          if (idx === -1) {
            const created: Conversation = {
              workspace,
              contact: evt.contact!,
              assignee: null,
              status: 'open',
              last_activity: nowIso,
              messages: [newMsg],
              unreadCount: 1,
            };
            return [created, ...prev];
          }

          const existing = prev[idx];
          const alreadyExists = existing.messages.some((m) => m.id === newMsg.id);
          const updated: Conversation = {
            ...existing,
            last_activity: nowIso,
            unreadCount:
              existing.contact === selectedContact
                ? 0
                : (existing.unreadCount || 0) + (alreadyExists ? 0 : 1),
            messages: alreadyExists ? existing.messages : [...existing.messages, newMsg],
          };
          const next = [...prev];
          next[idx] = updated;
          return next;
        }

        if (evt.type === 'conversation.assigned' && idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], assignee: evt.assignee ?? null };
          return next;
        }

        if (evt.type === 'message.status' && idx !== -1 && evt.client_ref) {
          const existing = prev[idx];
          const msgIdx = existing.messages.findIndex(
            (m) => m.client_ref === evt.client_ref || m.id === evt.client_ref
          );
          let nextMsgs = existing.messages;
          if (msgIdx !== -1) {
            nextMsgs = [...existing.messages];
            nextMsgs[msgIdx] = { ...nextMsgs[msgIdx], status: evt.status };
          } else if (evt.text) {
            nextMsgs = [
              ...existing.messages,
              {
                id: evt.client_ref,
                client_ref: evt.client_ref,
                direction: 'outbound',
                text: evt.text,
                status: evt.status || 'queued',
                occurred_at: nowIso,
              },
            ];
          }
          const next = [...prev];
          next[idx] = { ...existing, messages: nextMsgs, last_activity: nowIso };
          return next;
        }

        return prev;
      });
    },
    [workspace, selectedContact]
  );

  const { socketStatus } = useWorkspaceSocket(workspace, handleWsEvent);

  const selectConversation = useCallback((contact: string) => {
    setSelectedContact(contact);
    setConversations((prev) =>
      prev.map((c) => (c.contact === contact ? { ...c, unreadCount: 0 } : c))
    );
  }, []);

  const claim = useCallback(
    async (contact: string) => {
      if (!workspace) return;
      const res = await api.claimConversation(workspace, contact);
      setConversations((prev) =>
        prev.map((c) => (c.contact === contact ? { ...c, assignee: res.assignee } : c))
      );
    },
    [workspace]
  );

  const release = useCallback(
    async (contact: string) => {
      if (!workspace) return;
      await api.releaseConversation(workspace, contact);
      setConversations((prev) =>
        prev.map((c) => (c.contact === contact ? { ...c, assignee: null } : c))
      );
    },
    [workspace]
  );

  const toggleStatus = useCallback(
    async (contact: string, nextStatus: 'open' | 'closed') => {
      if (!workspace) return;
      await api.updateStatus(workspace, contact, nextStatus);
      setConversations((prev) =>
        prev.map((c) => (c.contact === contact ? { ...c, status: nextStatus } : c))
      );
    },
    [workspace]
  );

  const sendReply = useCallback(
    async (contact: string, text: string, isInternalNote: boolean) => {
      if (!workspace || !text.trim()) return;
      if (isInternalNote) {
        const noteMsg: MessageItem = {
          id: `note_${Date.now()}`,
          direction: 'note',
          text: text.trim(),
          occurred_at: new Date().toISOString(),
          author: currentSub,
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.contact === contact
              ? { ...c, messages: [...c.messages, noteMsg] }
              : c
          )
        );
        return;
      }

      const clientRef = `ui_${crypto.randomUUID()}`;
      const optimisticMsg: MessageItem = {
        id: clientRef,
        client_ref: clientRef,
        direction: 'outbound',
        text: text.trim(),
        status: 'queued',
        occurred_at: new Date().toISOString(),
        author: currentSub,
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.contact === contact
            ? {
                ...c,
                last_activity: optimisticMsg.occurred_at,
                messages: [...c.messages, optimisticMsg],
              }
            : c
        )
      );

      await api.sendReply(workspace, contact, text.trim(), clientRef);
    },
    [workspace, currentSub]
  );

  const counts = useMemo(() => {
    const open = conversations.filter((c) => c.status !== 'closed');
    return {
      all: open.length,
      mine: open.filter((c) => c.assignee === currentSub).length,
      unassigned: open.filter((c) => !c.assignee).length,
      closed: conversations.filter((c) => c.status === 'closed').length,
    };
  }, [conversations, currentSub]);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations
      .filter((c) => {
        if (filter === 'closed') return c.status === 'closed';
        if (c.status === 'closed') return false;
        if (filter === 'mine') return c.assignee === currentSub;
        if (filter === 'unassigned') return !c.assignee;
        return true;
      })
      .filter((c) => {
        if (!q) return true;
        if (c.contact.toLowerCase().includes(q)) return true;
        return c.messages.some((m) => m.text.toLowerCase().includes(q));
      })
      .sort((a, b) => {
        const diff =
          new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime();
        return sortNewestFirst ? diff : -diff;
      });
  }, [conversations, filter, currentSub, search, sortNewestFirst]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.contact === selectedContact) ?? null,
    [conversations, selectedContact]
  );

  return {
    conversations: filteredConversations,
    activeConversation,
    selectedContact,
    selectConversation,
    filter,
    setFilter,
    search,
    setSearch,
    sortNewestFirst,
    setSortNewestFirst,
    counts,
    loading,
    error,
    socketStatus,
    refresh: loadConversations,
    claim,
    release,
    toggleStatus,
    sendReply,
  };
}
