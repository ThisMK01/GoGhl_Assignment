import { useState } from 'react';
import { Icon } from '../common/Icon';
import { countSmsSegments } from '../../utils/format';

interface ReplyComposerProps {
  disabled?: boolean;
  onSend: (text: string, isInternalNote: boolean) => Promise<void>;
}

export function ReplyComposer({ disabled, onSend }: ReplyComposerProps) {
  const [text, setText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!text.trim() || sending || disabled) return;
    setSending(true);
    try {
      await onSend(text, isInternalNote);
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 bg-surface-container-lowest border-t border-outline-variant/30 flex flex-col gap-2 shrink-0">
      {/* Tabs */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center p-0.5 rounded bg-surface-container-low border border-outline-variant/30 font-mono text-[11px]">
          <button
            type="button"
            onClick={() => setIsInternalNote(false)}
            className={`px-3 py-1 rounded flex items-center gap-1.5 transition-all cursor-pointer ${
              !isInternalNote
                ? 'bg-primary text-on-primary font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Icon name="chat_bubble" className="text-[14px]" />
            <span>Public SMS Reply</span>
          </button>
          <button
            type="button"
            onClick={() => setIsInternalNote(true)}
            className={`px-3 py-1 rounded flex items-center gap-1.5 transition-all cursor-pointer ${
              isInternalNote
                ? 'bg-tertiary text-on-tertiary font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Icon name="lock" className="text-[14px]" />
            <span>Internal Note</span>
          </button>
        </div>
      </div>

      {/* Editor */}
      <div
        className={`rounded-lg bg-surface-container-low border transition-all ${
          isInternalNote
            ? 'border-tertiary/40 focus-within:border-tertiary focus-within:ring-2 focus-within:ring-tertiary/20'
            : 'border-outline-variant/40 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'
        }`}
      >
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={
            isInternalNote
              ? 'Add an internal note for team members (invisible to customer)...'
              : 'Type your reply to customer... (Press ⌘+Enter / Ctrl+Enter to send)'
          }
          className="w-full bg-transparent p-3 text-on-surface text-sm placeholder:text-on-surface-variant/50 focus:outline-none resize-none"
        />

        <div className="px-3 py-2 border-t border-outline-variant/20 flex items-center justify-between text-on-surface-variant">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isInternalNote ? 'bg-tertiary' : 'bg-primary'
              }`}
            />
            <span>{isInternalNote ? 'Team-only Note' : 'Pigeon Outbound SMS'}</span>
            <span>•</span>
            <span>
              {text.length} chars ({countSmsSegments(text)} segment
              {countSmsSegments(text) === 1 ? '' : 's'})
            </span>
          </div>

          <button
            type="button"
            disabled={!text.trim() || sending || disabled}
            onClick={handleSend}
            className={`px-4 py-1.5 rounded font-mono text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isInternalNote
                ? 'bg-tertiary hover:bg-tertiary-fixed text-on-tertiary'
                : 'bg-primary hover:bg-primary-fixed text-on-primary shadow-[0_0_16px_rgba(78,222,163,0.35)]'
            }`}
          >
            <span>{sending ? 'Sending...' : isInternalNote ? 'Save Note' : 'Send Reply'}</span>
            <Icon name={isInternalNote ? 'lock' : 'send'} className="text-[15px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
