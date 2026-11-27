import { useState } from 'react';
import { Icon } from '../common/Icon';
import { getInitials, getWorkspaceDisplayName } from '../../utils/format';
import type { QueueFilter, SocketStatus, UserSession } from '../../types/inbox';

interface TopHeaderProps {
  user: UserSession;
  activeWorkspace: string;
  onSelectWorkspace: (wsId: string) => void;
  filter: QueueFilter;
  onSelectFilter: (f: QueueFilter) => void;
  socketStatus: SocketStatus;
  onLogout: () => void;
}

const NAV_TABS: Array<{ id: QueueFilter; label: string }> = [
  { id: 'all', label: 'All Inboxes' },
  { id: 'mine', label: 'Assigned to Me' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'closed', label: 'Closed' },
];

export function TopHeader({
  user,
  activeWorkspace,
  onSelectWorkspace,
  filter,
  onSelectFilter,
  socketStatus,
  onLogout,
}: TopHeaderProps) {
  const [wsOpen, setWsOpen] = useState(false);

  const socketLabel =
    socketStatus === 'connected'
      ? 'Connected'
      : socketStatus === 'connecting'
      ? 'Connecting...'
      : 'Reconnecting';

  const dotColor =
    socketStatus === 'connected'
      ? 'bg-primary shadow-[0_0_8px_rgba(78,222,163,0.6)] animate-pulse'
      : socketStatus === 'connecting'
      ? 'bg-secondary animate-pulse'
      : 'bg-error';

  return (
    <header className="fixed top-0 inset-x-0 h-16 z-50 bg-surface-container-lowest/90 backdrop-blur-xl border-b border-outline-variant/30 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 border border-primary/30 text-primary">
            <Icon name="hub" className="text-[19px]" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
          </div>
          <span className="text-lg font-semibold tracking-tight text-on-surface">
            Switchboard
          </span>
        </div>

        <div className="h-5 w-px bg-outline-variant/40" />

        {/* Workspace Switcher */}
        <div className="relative">
          <button
            onClick={() => setWsOpen((o) => !o)}
            className="flex items-center gap-2 bg-surface-container-low hover:bg-surface-container px-2.5 py-1 rounded border border-outline-variant/30 cursor-pointer transition-colors"
          >
            <div className="flex flex-col text-left">
              <span className="text-xs text-on-surface font-medium leading-none">
                {getWorkspaceDisplayName(activeWorkspace)}
              </span>
              <span className="text-[11px] text-on-surface-variant font-mono leading-none mt-1">
                ({activeWorkspace})
              </span>
            </div>
            <Icon name="expand_more" className="text-on-surface-variant text-[18px]" />
          </button>

          {wsOpen && (
            <div className="absolute left-0 mt-1.5 w-52 rounded-lg bg-surface-container border border-outline-variant/40 shadow-xl py-1 z-50">
              {user.workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    onSelectWorkspace(ws.id);
                    setWsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs hover:bg-surface-container-high transition-colors ${
                    ws.id === activeWorkspace ? 'text-primary font-semibold' : 'text-on-surface'
                  }`}
                >
                  <div>
                    <div>{getWorkspaceDisplayName(ws.id)}</div>
                    <div className="font-mono text-[10px] text-on-surface-variant">
                      {ws.id} · {ws.role}
                    </div>
                  </div>
                  {ws.id === activeWorkspace && <Icon name="check" className="text-[16px]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center Nav */}
      <nav className="hidden lg:flex items-center p-1 bg-surface-container-lowest rounded-lg border border-outline-variant/20 gap-1">
        {NAV_TABS.map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectFilter(tab.id)}
              className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
                active
                  ? 'bg-surface-container-high text-primary border border-outline-variant/40 shadow-sm font-medium'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Right Status & Profile */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-lowest border border-outline-variant/30">
          <span className={`h-2 w-2 rounded-full ${dotColor}`} />
          <span className="text-[11px] text-on-surface font-mono">{socketLabel}</span>
        </div>

        <div className="h-5 w-px bg-outline-variant/40" />

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-surface-container-high border border-primary/40 flex items-center justify-center font-mono text-xs font-semibold text-primary">
            {getInitials(user.sub)}
          </div>
          <div className="hidden xl:flex flex-col text-left">
            <span className="text-xs font-medium text-on-surface leading-none">
              {user.sub}
            </span>
            <span className="text-[11px] font-mono text-on-surface-variant leading-none mt-1">
              {user.workspaces.find((w) => w.id === activeWorkspace)?.role ?? 'agent'}
            </span>
          </div>
          <button
            onClick={onLogout}
            title="Sign out"
            className="ml-1 p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-surface-container transition-colors cursor-pointer"
          >
            <Icon name="logout" className="text-[18px]" />
          </button>
        </div>
      </div>
    </header>
  );
}
