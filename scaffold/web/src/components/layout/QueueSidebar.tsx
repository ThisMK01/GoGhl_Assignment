import { Icon } from '../common/Icon';
import type { QueueFilter } from '../../types/inbox';

interface QueueSidebarProps {
  filter: QueueFilter;
  onSelectFilter: (f: QueueFilter) => void;
  counts: {
    all: number;
    mine: number;
    unassigned: number;
    closed: number;
  };
  onRefresh: () => void;
}

export function QueueSidebar({
  filter,
  onSelectFilter,
  counts,
  onRefresh,
}: QueueSidebarProps) {
  const items: Array<{
    id: QueueFilter;
    label: string;
    icon: string;
    count: number;
    badgeClass: string;
  }> = [
    {
      id: 'all',
      label: 'All Inboxes',
      icon: 'inbox',
      count: counts.all,
      badgeClass: 'bg-surface-container text-on-surface-variant',
    },
    {
      id: 'mine',
      label: 'Assigned to Me',
      icon: 'person',
      count: counts.mine,
      badgeClass: 'bg-surface-container text-primary',
    },
    {
      id: 'unassigned',
      label: 'Unassigned',
      icon: 'mark_email_unread',
      count: counts.unassigned,
      badgeClass: 'bg-surface-container text-on-surface-variant',
    },
    {
      id: 'closed',
      label: 'Closed',
      icon: 'check_circle',
      count: counts.closed,
      badgeClass: 'bg-surface-container text-on-surface-variant',
    },
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-16 bottom-0 w-60 bg-surface-container-lowest border-r border-outline-variant/20 z-40 flex-col justify-between p-3">
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <span className="text-[11px] font-mono uppercase text-on-surface-variant tracking-wider">
            Queues
          </span>
          <button
            onClick={onRefresh}
            title="Refresh inbox"
            className="text-on-surface-variant hover:text-on-surface cursor-pointer"
          >
            <Icon name="refresh" className="text-[18px]" />
          </button>
        </div>

        <nav className="space-y-1">
          {items.map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectFilter(item.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded text-xs transition-colors cursor-pointer ${
                  active
                    ? 'bg-surface-container-high text-on-surface font-medium border-l-2 border-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon name={item.icon} className="text-[18px]" />
                  <span>{item.label}</span>
                </div>
                <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${item.badgeClass}`}>
                  {item.count}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="pt-3 border-t border-outline-variant/20">
          <span className="text-[11px] font-mono uppercase text-on-surface-variant tracking-wider px-2 block mb-2">
            Channel
          </span>
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-on-surface-variant">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>Pigeon SMS</span>
            </div>
            <span className="font-mono text-[11px]">{counts.all}</span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-outline-variant/20 px-2 text-[11px] font-mono text-on-surface-variant flex items-center justify-between">
        <span>Switchboard v1</span>
        <span className="text-primary">Live WS</span>
      </div>
    </aside>
  );
}
