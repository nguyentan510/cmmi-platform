import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  FolderOpen,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  Users,
  X,
} from 'lucide-react';
import { type User, makeApi } from './services/api';
import Login from './pages/Login/Login';
import ContentManager from './pages/ContentManager/ContentManager';
import MediaLibrary from './pages/MediaLibrary/MediaLibrary';
import ApiKeys from './pages/ApiKeys/ApiKeys';
import Settings from './pages/Settings/Settings';
import UserManager from './pages/Users/Users';
import DocsViewer from './pages/DocsViewer/DocsViewer';

type Page = 'contents' | 'media' | 'keys' | 'settings' | 'users' | 'help';
const navigation = [
  { id: 'contents', label: 'Content workspace', icon: LayoutDashboard },
  { id: 'media', label: 'Media library', icon: FolderOpen },
  { id: 'keys', label: 'API keys', icon: KeyRound },
  { id: 'users', label: 'Users', icon: Users, admin: true },
  { id: 'settings', label: 'Settings', icon: Settings2, admin: true },
  { id: 'help', label: 'Help & docs', icon: BookOpen },
] as const;

export default function App() {
  const [session, setSession] = useState<{ token: string; user: User } | null>(null);
  const [page, setPage] = useState<Page>(
    window.location.pathname === '/help' ? 'help' : 'contents',
  );
  const [mobile, setMobile] = useState(false);
  const api = useMemo(() => makeApi(session?.token), [session?.token]);
  useEffect(() => {
    const logout = () => setSession(null);
    window.addEventListener('cmmi:unauthorized', logout);
    return () => window.removeEventListener('cmmi:unauthorized', logout);
  }, []);
  if (!session)
    return (
      <Login
        onLogin={(token, user) => {
          setSession({ token, user });
          setPage(window.location.pathname === '/help' ? 'help' : 'contents');
        }}
      />
    );
  const selected = navigation.find((item) => item.id === page)!;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <a
            className="brand"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setPage('contents');
            }}
          >
            <span className="brand__mark">
              c<span>·</span>
            </span>
            cmmi<span className="brand__tag">STUDIO</span>
          </a>
          <button
            className="mobile-only icon-button"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-label__icon">W</span>
          <div>
            Your workspace
            <small>{session.user.role === 'ADMIN' ? 'Administrator' : 'Creator'}</small>
          </div>
          <ChevronRight size={14} />
        </div>
        <span className="sidebar__section">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {navigation
            .filter((item) => !('admin' in item) || session.user.role === 'ADMIN')
            .map((item) => (
              <button
                key={item.id}
                className={page === item.id ? 'nav-item nav-item--active' : 'nav-item'}
                aria-current={page === item.id ? 'page' : undefined}
                onClick={() => {
                  setPage(item.id);
                  setMobile(false);
                }}
              >
                <item.icon size={18} strokeWidth={1.7} />
                {item.label}
                {page === item.id && <span className="nav-item__dot" />}
              </button>
            ))}
        </nav>
        <div className="sidebar__guide">
          <span className="eyebrow">BUILT FOR YOUR WORKFLOW</span>
          <h3>
            A home for
            <br />
            every story.
          </h3>
          <p>Connect your tools with one simple API.</p>
          <a href="/docs" target="_blank" rel="noreferrer">
            Explore the API
            <ArrowUpRight size={16} />
          </a>
        </div>
        <div className="sidebar__profile">
          <span className="avatar">{session.user.email.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{session.user.email.split('@')[0]}</strong>
            <small>{session.user.role.toLowerCase()}</small>
          </div>
          <button aria-label="Sign out" title="Sign out" onClick={() => setSession(null)}>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <button
              className="mobile-only icon-button"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{selected.label}</strong>
          </div>
          <div className="topbar__right">
            <span className="live-dot" />
            Your creative operations, connected
            <span className="topbar__avatar">{session.user.email.slice(0, 1).toUpperCase()}</span>
          </div>
        </header>
        <main key={session.user.id}>
          <div className="page-heading">
            <div>
              <span className="eyebrow">YOUR WORK, IN A GOOD PLACE</span>
              <h1>{selected.label}</h1>
              <p>
                {page === 'contents'
                  ? 'From first idea to published story. Keep it all moving.'
                  : page === 'media'
                    ? 'A considered collection of everything you create.'
                    : page === 'keys'
                      ? 'Connect your agents and automations, on your terms.'
                      : page === 'settings'
                        ? 'A little housekeeping for a lighter workspace.'
                        : page === 'users'
                          ? 'Good work happens with the right people.'
                          : 'Everything you need to make yourself at home.'}
              </p>
            </div>
            <span className="page-heading__date">
              {new Date().toLocaleDateString('en', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          {page === 'contents' && <ContentManager api={api} onHelp={() => setPage('help')} />}
          {page === 'media' && <MediaLibrary api={api} />}
          {page === 'keys' && <ApiKeys api={api} isAdmin={session.user.role === 'ADMIN'} />}
          {page === 'settings' && <Settings api={api} />}
          {page === 'users' && <UserManager api={api} currentUser={session.user} />}
          {page === 'help' && <DocsViewer />}
          <footer className="workspace-footer">
            <span>
              CMMI <span>·</span> A little structure. More room to create.
            </span>
            <a href="/llms.txt" target="_blank" rel="noreferrer">
              Made for humans & agents <ArrowUpRight size={12} />
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
