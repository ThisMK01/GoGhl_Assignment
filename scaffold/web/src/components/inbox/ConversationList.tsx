import { Icon } from '../common/Icon';
import { formatRelativeTime } from '../../utils/format';
import type { Conversation, QueueFilter } from '../../types/inbox';

interface ConversationListProps {
  conversations: Conversation[];
  selectedContact: string | null;
  currentSub: string;
  filter: QueueFilter;
  onSelectFilter: (f: QueueFilter) => void;
  search: string;
  onSearchChange: (v: string) => void;
  sortNewestFirst: boolean;
  onToggleSort: () => void;
  counts: { all: number; mine: number; unassigned: number; closed: number };
  onSelectConversation: (contact: string) => void;
  onClaim: (contact: string) => void;
  loading: boolean;
}

export function ConversationList({
  conversations,
  selectedContact,
  currentSub,
  filter,
  onSelectFilter,
  search,
  onSearchChange,
  sortNewestFirst,
  onToggleSort,
  counts,
  onSelectConversation,
  onClaim,
  loading,
}: ConversationListProps) {
  return (
    <aside className="w-full sm:w-[340px] flex-shrink-0 flex flex-col bg-surface-container-lowest border-r border-outline-variant/30 select-none">
      {/* Search & Filter Tabs */}
      <div className="p-3 border-b border-outline-variant/20 flex flex-col gap-2 bg-surface-container-lowest/80">
        <div className="relative flex items-center">
          <Icon
            name="search"
            className="absolute left-2.5 text-on-surface-variant text-[18px] pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search phone or message..."
            className="w-full bg-surface-container-low text-on-surface text-xs pl-8 pr-7 py-1.5 rounded border border-outline-variant/40 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder:text-on-surface-variant/60"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 text-on-surface-variant hover:text-on-surface flex items-center cursor-pointer"
            >
              <Icon name="cancel" className="text-[16px]" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-1 pt-0.5">
          <div className="flex items-center gap-1 overflow-x-auto">
            {(
              [
                ['all', 'All', counts.all],
                ['unassigned', 'Unassigned', counts.unassigned],
                ['mine', 'Mine', counts.mine],
              ] as const
            ).map(([id, label, count]) => {
              const active = filter === id;
              return (
                <button
                  key={id}
                  onClick={() => onSelectFilter(id)}
                  className={`px-2 py-1 rounded font-mono text-[11px] flex items-center gap-1 transition-colors cursor-pointer ${
                    active
                      ? 'bg-surface-container-high text-primary border border-outline-variant/40'
                      : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span>{label}</span>
                  <span className="bg-surface-container px-1 rounded">{count}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={onToggleSort}
            title={sortNewestFirst ? 'Sorted: Newest first' : 'Sorted: Oldest first'}
            className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors flex items-center cursor-pointer"
          >
            <Icon name="swap_vert" className="text-[18px]" />
          </button>
        </div>
      </div>

      {/* Ticket List */}
      <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/10">
        {loading && conversations.length === 0 ? (
          <div className="p-6 text-center text-xs font-mono text-on-surface-variant">
            Loading conversations...
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center text-xs font-mono text-on-surface-variant">
            No conversations in this queue.
          </div>
        ) : (
          conversations.map((conv) => {
            const isSelected = conv.contact === selectedContact;
            const lastMsg = conv.messages[conv.messages.length - 1];
            const isMine = conv.assignee === currentSub;
            const isClosed = conv.status === 'closed';

            return (
              <div
                key={conv.contact}
                onClick={() => onSelectConversation(conv.contact)}
                className={`relative p-3 cursor-pointer transition-all duration-150 group ${
                  isSelected
                    ? 'bg-surface-container-high/60 border-l-[3px] border-primary'
                    : 'hover:bg-surface-container-low'
                } ${isClosed ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span
                    className={`font-mono text-xs font-semibold truncate ${
                      isSelected ? 'text-primary' : 'text-on-surface'
                    } ${isClosed ? 'line-through text-on-surface-variant' : ''}`}
                  >
                    {conv.contact}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {(conv.unreadCount ?? 0) > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-mono text-[10px] gap-1 ring-1 ring-primary/40">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        {conv.unreadCount} new
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-on-surface-variant">
                      {formatRelativeTime(conv.last_activity)}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-on-surface-variant line-clamp-2 mb-2 leading-relaxed">
                  {lastMsg ? lastMsg.text : 'No messages yet'}
                </p>

                <div className="flex items-center justify-between">
                  {isClosed ? (
                    <span className="inline-flex items-center gap-1 text-on-surface-variant font-mono text-[11px]">
                      <Icon name="check_circle" className="text-[14px] text-primary" />
                      Closed
                    </span>
                  ) : conv.assignee ? (
                    <div className="flex items-center gap-1.5 bg-surface-container-lowest/80 px-2 py-0.5 rounded border border-outline-variant/30">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isMine ? 'bg-primary' : 'bg-tertiary'
                        }`}
                      />
                      <span className="font-mono text-[11px] text-on-surface">
                        {isMine ? 'Assigned to you' : conv.assignee}
                      </span>
                    </div>
                  ) : (
                    <>
                      <span className="font-mono text-[11px] text-on-surface-variant">
                        Unassigned
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onClaim(conv.contact);
                        }}
                        className="px-2.5 py-0.5 rounded bg-primary text-on-primary font-mono text-[11px] font-semibold flex items-center gap-1 hover:bg-primary-fixed transition-all cursor-pointer"
                      >
                        <span>Claim</span>
                        <Icon name="bolt" className="text-[13px]" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
