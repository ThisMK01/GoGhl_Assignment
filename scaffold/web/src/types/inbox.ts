export interface WorkspaceMembership {
  id: string;
  role: 'admin' | 'agent' | string;
}

export interface UserSession {
  sub: string;
  workspaces: WorkspaceMembership[];
}

export type MessageDirection = 'inbound' | 'outbound' | 'note';
export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed';

export interface MessageItem {
  id: string;
  client_ref?: string;
  direction: MessageDirection;
  text: string;
  status?: DeliveryStatus;
  occurred_at: string;
  author?: string;
}

export interface Conversation {
  _id?: string;
  workspace: string;
  contact: string;
  assignee: string | null;
  status: 'open' | 'closed';
  last_activity: string;
  messages: MessageItem[];
  unreadCount?: number;
}

export type QueueFilter = 'all' | 'mine' | 'unassigned' | 'closed';

export interface WsEvent {
  seq: number;
  type: 'message.inbound' | 'message.status' | 'conversation.assigned';
  contact: string | null;
  message_id?: string;
  client_ref?: string;
  status?: DeliveryStatus;
  text?: string;
  occurred_at?: string;
  assignee?: string | null;
}

export type SocketStatus = 'connecting' | 'connected' | 'disconnected';
