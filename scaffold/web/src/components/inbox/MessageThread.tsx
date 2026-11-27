import { useEffect, useRef } from 'react';
import { Icon } from '../common/Icon';
import { formatTime, getContactShortCode, getInitials } from '../../utils/format';
import type { MessageItem } from '../../types/inbox';

interface MessageThreadProps {
  contact: string;
  messages: MessageItem[];
  currentSub: string;
}

function StatusIndicator({ status }: { status?: string }) {
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-error">
        <Icon name="error" className="text-[14px]" />
        <span>Failed</span>
      </span>
    );
  }
  if (status === 'delivered') {
    return (
      <span className="inline-flex items-center gap-1 text-primary">
        <Icon name="done_all" className="text-[14px]" />
        <span>Delivered</span>
      </span>
    );
  }
  if (status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 text-secondary">
        <Icon name="done" className="text-[14px]" />
        <span>Sent</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-on-surface-variant">
      <Icon name="schedule" className="text-[14px]" />
      <span>Queued</span>
    </span>
  );
}

export function MessageThread({ contact, messages, currentSub }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, contact]);

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      {messages.length === 0 ? (
        <div className="h-full flex items-center justify-center text-xs font-mono text-on-surface-variant">
          No messages in this conversation yet.
        </div>
      ) : (
        messages.map((msg) => {
          if (msg.direction === 'note') {
            return (
              <div key={msg.id} className="flex items-start gap-2.5 max-w-2xl ml-auto flex-row-reverse">
                <div className="w-8 h-8 rounded-full bg-tertiary-container/25 border border-tertiary/40 flex items-center justify-center font-mono text-xs font-semibold text-tertiary shrink-0">
                  <Icon name="lock" className="text-[15px]" />
                </div>
                <div className="flex flex-col items-end gap-1 min-w-0">
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-on-surface-variant">{formatTime(msg.occurred_at)}</span>
                    <span className="text-tertiary font-medium">Internal Note</span>
                  </div>
                  <div className="bg-tertiary-container/15 border border-tertiary/30 rounded-xl rounded-tr-sm p-3 text-on-surface text-sm leading-relaxed">
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          }

          if (msg.direction === 'outbound') {
            return (
              <div key={msg.id} className="flex items-start gap-2.5 max-w-2xl ml-auto flex-row-reverse">
                <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center font-mono text-xs font-semibold text-primary shrink-0">
                  {getInitials(msg.author || currentSub)}
                </div>
                <div className="flex flex-col items-end gap-1 min-w-0">
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-on-surface-variant">{formatTime(msg.occurred_at)}</span>
                    <span className="text-primary font-medium">{msg.author || currentSub}</span>
                  </div>
                  <div className="bg-surface-container-high/90 border border-primary/30 rounded-xl rounded-tr-sm p-3 text-on-surface text-sm leading-relaxed shadow-[0_0_16px_-4px_rgba(78,222,163,0.15)]">
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
                    <StatusIndicator status={msg.status} />
                    <span>• {formatTime(msg.occurred_at)}</span>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex items-start gap-2.5 max-w-2xl">
              <div className="w-8 h-8 rounded-full bg-surface-container-highest border border-outline-variant/40 flex items-center justify-center font-mono font-semibold text-primary shrink-0 text-xs">
                {getContactShortCode(contact)}
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-on-surface font-medium">{contact}</span>
                  <span className="text-on-surface-variant">{formatTime(msg.occurred_at)}</span>
                  <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant text-[10px]">
                    Inbound SMS
                  </span>
                </div>
                <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl rounded-tl-sm p-3 text-on-surface text-sm leading-relaxed shadow-sm">
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}
