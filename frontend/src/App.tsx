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
  Users as UsersIcon,
  X,
} from 'lucide-react';
import { type User, makeApi } from './services/api';
import Login from './pages/Login/Login';
import ContentManager from './pages/ContentManager/ContentManager';
import MediaLibrary from './pages/MediaLibrary/MediaLibrary';
import Settings, { type SettingsTab } from './pages/Settings/Settings';
import DocsViewer from './pages/DocsViewer/DocsViewer';

type Page = 'contents' | 'media' | 'settings' | 'help';

const SESSION_STORAGE_KEY = 'cmmi_session';

function getStoredSession(): { token: string; user: User } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSessionState] = useState<{ token: string; user: User } | null>(
    getStoredSession,
  );
  const setSession = (data: { token: string; user: User } | null) => {
    setSessionState(data);
    try {
      if (data) sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
      else sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore storage access errors
    }
  };
  const [page, setPage] = useState<Page>(
    window.location.pathname === '/help' ? 'help' : 'contents',
  );
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('cleanup');
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

  const pageTitle =
    page === 'contents'
      ? 'Content workspace'
      : page === 'media'
        ? 'Media library'
        : page === 'help'
          ? 'Help & docs'
          : settingsTab === 'keys'
            ? 'API keys'
            : settingsTab === 'users'
              ? 'Users'
              : 'Settings';

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
          {/* Content workspace */}
          <button
            className={page === 'contents' ? 'nav-item nav-item--active' : 'nav-item'}
            aria-current={page === 'contents' ? 'page' : undefined}
            onClick={() => {
              setPage('contents');
              setMobile(false);
            }}
          >
            <LayoutDashboard size={18} strokeWidth={1.7} />
            Content workspace
            {page === 'contents' && <span className="nav-item__dot" />}
          </button>

          {/* Media library */}
          <button
            className={page === 'media' ? 'nav-item nav-item--active' : 'nav-item'}
            aria-current={page === 'media' ? 'page' : undefined}
            onClick={() => {
              setPage('media');
              setMobile(false);
            }}
          >
            <FolderOpen size={18} strokeWidth={1.7} />
            Media library
            {page === 'media' && <span className="nav-item__dot" />}
          </button>

          {/* Settings Group (Unified Hub) */}
          <div className="nav-group">
            <button
              className={
                page === 'settings' && settingsTab === 'cleanup'
                  ? 'nav-item nav-item--active'
                  : 'nav-item'
              }
              aria-current={page === 'settings' && settingsTab === 'cleanup' ? 'page' : undefined}
              onClick={() => {
                setPage('settings');
                setSettingsTab('cleanup');
                setMobile(false);
              }}
            >
              <Settings2 size={18} strokeWidth={1.7} />
              Settings
              {page === 'settings' && settingsTab === 'cleanup' && <span className="nav-item__dot" />}
            </button>

            <div className="nav-sub-items">
              <button
                className={
                  page === 'settings' && settingsTab === 'keys'
                    ? 'nav-sub-item nav-sub-item--active'
                    : 'nav-sub-item'
                }
                onClick={() => {
                  setPage('settings');
                  setSettingsTab('keys');
                  setMobile(false);
                }}
              >
                <KeyRound size={15} strokeWidth={1.7} />
                API keys
                {page === 'settings' && settingsTab === 'keys' && <span className="nav-item__dot" />}
              </button>

              {session.user.role === 'ADMIN' && (
                <button
                  className={
                    page === 'settings' && settingsTab === 'users'
                      ? 'nav-sub-item nav-sub-item--active'
                      : 'nav-sub-item'
                  }
                  onClick={() => {
                    setPage('settings');
                    setSettingsTab('users');
                    setMobile(false);
                  }}
                >
                  <UsersIcon size={15} strokeWidth={1.7} />
                  Users
                  {page === 'settings' && settingsTab === 'users' && <span className="nav-item__dot" />}
                </button>
              )}
            </div>
          </div>

          {/* Help & docs */}
          <button
            className={page === 'help' ? 'nav-item nav-item--active' : 'nav-item'}
            aria-current={page === 'help' ? 'page' : undefined}
            onClick={() => {
              setPage('help');
              setMobile(false);
            }}
          >
            <BookOpen size={18} strokeWidth={1.7} />
            Help & docs
            {page === 'help' && <span className="nav-item__dot" />}
          </button>
        </nav>

        {/* User profile fixed at bottom of sidebar (Cleaned up, no promo banner) */}
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
          <div className="topbar__left">
            <button
              className="mobile-only icon-button"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{pageTitle}</strong>
          </div>
          <div className="topbar__right">
            <span className="live-dot" title="Workspace operational" />
            <span className="topbar__role-badge">
              {session.user.role === 'ADMIN' ? 'Admin' : 'Creator'}
            </span>
          </div>
        </header>

        <main key={session.user.id}>
          {/* Streamlined Page Heading */}
          <div className="page-heading page-heading--compact">
            <div className="page-heading__left">
              <h1>{pageTitle}</h1>
            </div>
            <div className="page-heading__actions">
              <a
                href="/help"
                className="meet-workspace-link"
                onClick={(e) => {
                  e.preventDefault();
                  setPage('help');
                }}
              >
                Meet your workspace <ArrowUpRight size={13} />
              </a>
            </div>
          </div>

          {page === 'contents' && <ContentManager api={api} onHelp={() => setPage('help')} />}
          {page === 'media' && <MediaLibrary api={api} />}
          {page === 'settings' && (
            <Settings
              api={api}
              currentUser={session.user}
              activeTab={settingsTab}
              onTabChange={setSettingsTab}
            />
          )}
          {page === 'help' && <DocsViewer />}

          <footer className="workspace-footer">
            <span>CMMI Studio · Content & Media Management</span>
            <a href="/llms.txt" target="_blank" rel="noreferrer">
              LLMs Context <ArrowUpRight size={12} />
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
