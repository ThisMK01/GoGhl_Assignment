import { useAuth } from './hooks/useAuth';
import { useInbox } from './hooks/useInbox';
import { LoginScreen } from './components/auth/LoginScreen';
import { TopHeader } from './components/layout/TopHeader';
import { QueueSidebar } from './components/layout/QueueSidebar';
import { ConversationList } from './components/inbox/ConversationList';
import { ThreadHeader } from './components/inbox/ThreadHeader';
import { MessageThread } from './components/inbox/MessageThread';
import { ReplyComposer } from './components/inbox/ReplyComposer';

export function App() {
  const { user, loading: authLoading, activeWorkspace, setActiveWorkspace, login, logout } =
    useAuth();

  const inbox = useInbox(activeWorkspace, user?.sub);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center font-mono text-xs text-on-surface-variant">
        Checking session...
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  const active = inbox.activeConversation;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <TopHeader
        user={user}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={setActiveWorkspace}
        filter={inbox.filter}
        onSelectFilter={inbox.setFilter}
        socketStatus={inbox.socketStatus}
        onLogout={logout}
      />

      <QueueSidebar
        filter={inbox.filter}
        onSelectFilter={inbox.setFilter}
        counts={inbox.counts}
        onRefresh={inbox.refresh}
      />

      <div className="md:pl-60 pt-16">
        <main className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-surface">
          <ConversationList
            conversations={inbox.conversations}
            selectedContact={inbox.selectedContact}
            currentSub={user.sub}
            filter={inbox.filter}
            onSelectFilter={inbox.setFilter}
            search={inbox.search}
            onSearchChange={inbox.setSearch}
            sortNewestFirst={inbox.sortNewestFirst}
            onToggleSort={() => inbox.setSortNewestFirst((v) => !v)}
            counts={inbox.counts}
            onSelectConversation={inbox.selectConversation}
            onClaim={inbox.claim}
            loading={inbox.loading}
          />

          <section className="flex-1 flex flex-col bg-surface overflow-hidden">
            {active ? (
              <>
                <ThreadHeader
                  conversation={active}
                  currentSub={user.sub}
                  onClaim={() => inbox.claim(active.contact)}
                  onRelease={() => inbox.release(active.contact)}
                  onToggleStatus={() =>
                    inbox.toggleStatus(
                      active.contact,
                      active.status === 'closed' ? 'open' : 'closed'
                    )
                  }
                />
                <MessageThread
                  contact={active.contact}
                  messages={active.messages}
                  currentSub={user.sub}
                />
                <ReplyComposer
                  onSend={(text, isNote) => inbox.sendReply(active.contact, text, isNote)}
                />
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <p className="font-mono text-sm text-on-surface mb-1">
                  Select a conversation
                </p>
                <p className="text-xs text-on-surface-variant">
                  Choose a ticket from the queue on the left to view messages and reply.
                </p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
