import { Icon } from '../common/Icon';
import type { Conversation } from '../../types/inbox';

interface ThreadHeaderProps {
  conversation: Conversation;
  currentSub: string;
  onClaim: () => void;
  onRelease: () => void;
  onToggleStatus: () => void;
}

export function ThreadHeader({
  conversation,
  currentSub,
  onClaim,
  onRelease,
  onToggleStatus,
}: ThreadHeaderProps) {
  const isMine = conversation.assignee === currentSub;
  const isClosed = conversation.status === 'closed';

  return (
    <>
      <header className="px-5 py-3 bg-surface-container-lowest border-b border-outline-variant/30 flex items-center justify-between shrink-0 z-10 gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg text-on-surface font-mono font-bold tracking-tight">
              {conversation.contact}
            </h1>
            {isClosed ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant/40 text-on-surface-variant font-mono text-[11px]">
                Closed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary font-mono text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Open Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant font-mono text-[11px]">
            <span>
              Workspace: <strong className="text-on-surface">{conversation.workspace}</strong>
            </span>
            <span>•</span>
            <span>
              Messages: <strong className="text-on-surface">{conversation.messages.length}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {conversation.assignee && (
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container border border-outline-variant/30 font-mono text-[11px] text-on-surface mr-1">
              <span className={`w-2 h-2 rounded-full ${isMine ? 'bg-primary' : 'bg-tertiary'}`} />
              <span>Assigned: {isMine ? 'You' : conversation.assignee}</span>
            </div>
          )}

          {!conversation.assignee ? (
            <button
              onClick={onClaim}
              className="px-3 py-1.5 rounded bg-primary hover:bg-primary-fixed text-on-primary font-mono text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Icon name="bolt" className="text-[15px]" />
              <span>Claim</span>
            </button>
          ) : isMine ? (
            <button
              onClick={onRelease}
              className="px-2.5 py-1.5 rounded bg-surface-container-low hover:bg-surface-container border border-outline-variant/40 text-on-surface-variant hover:text-on-surface font-mono text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Icon name="call_missed_outgoing" className="text-[15px]" />
              <span>Release</span>
            </button>
          ) : null}

          <button
            onClick={onToggleStatus}
            className={`px-3 py-1.5 rounded font-mono text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isClosed
                ? 'bg-surface-container-high hover:bg-surface-bright text-on-surface border border-outline-variant/40'
                : 'bg-primary/15 hover:bg-primary/25 text-primary border border-primary/40'
            }`}
          >
            <Icon name={isClosed ? 'lock_open' : 'check_circle'} className="text-[15px]" />
            <span>{isClosed ? 'Reopen' : 'Resolve & Close'}</span>
          </button>
        </div>
      </header>
    </>
  );
}
