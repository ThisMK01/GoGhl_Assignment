import { Icon } from '../common/Icon';

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 border border-primary/30 text-primary">
            <Icon name="hub" className="text-[22px]" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-on-surface">
              Switchboard
            </h1>
            <p className="text-xs font-mono text-on-surface-variant">
              Shared Team Inbox • Multi-Tenant
            </p>
          </div>
        </div>

        <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
          Sign in with your organization OpenID Connect account to access live customer
          conversations, claim tickets, and send replies in real time.
        </p>

        <button
          onClick={onLogin}
          className="w-full py-2.5 px-4 rounded-lg bg-primary hover:bg-primary-fixed text-on-primary font-mono text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(78,222,163,0.3)] transition-all cursor-pointer"
        >
          <Icon name="login" className="text-[18px]" />
          <span>Sign in with Mock IdP</span>
        </button>

        <div className="mt-6 pt-4 border-t border-outline-variant/20 flex items-center justify-between text-[11px] font-mono text-on-surface-variant">
          <span>PKCE (S256) Enabled</span>
          <span>OAuth 2.0 / OIDC</span>
        </div>
      </div>
    </div>
  );
}
