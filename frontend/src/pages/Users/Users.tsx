import { useState, type FormEvent } from 'react';
import { Plus, UsersRound } from 'lucide-react';
import { ErrorBox, Pager } from '../../components/Shared';
import { type Api, type User, dateText, errorMessage, result } from '../../services/api';
import { useLoad } from '../../services/useLoad';

export default function UserManager({ api, currentUser }: { api: Api; currentUser: User }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'CREATOR' | 'ADMIN'>('CREATOR');
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const users = useLoad(
    () => result(api.GET('/api/v1/users', { params: { query: { offset, limit: 50 } } })),
    [api, offset],
  );
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await result(api.POST('/api/v1/users', { body: { email, password, role } }));
      setEmail('');
      setPassword('');
      setMessage('User created. Share their initial credentials through your secure channel.');
      users.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function change(user: User, change: { is_active?: boolean; role?: 'ADMIN' | 'CREATOR' }) {
    if (!window.confirm(`Update access for ${user.email}?`)) return;
    setBusy(true);
    setError('');
    try {
      await result(
        api.PATCH('/api/v1/users/{user_id}', {
          params: { path: { user_id: user.id } },
          body: change,
        }),
      );
      users.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ErrorBox message={error || users.error} />
      {message && (
        <div role="status" className="notice notice--success">
          {message}
        </div>
      )}
      <section className="panel">
        <div className="panel__heading">
          <div>
            <h2>Invite a new perspective</h2>
            <p>Create a workspace account for your team.</p>
          </div>
          <UsersRound size={23} />
        </div>
        <form className="settings-form" onSubmit={create}>
          <div className="form-grid">
            <label>
              User email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Initial password
              <input
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
          </div>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="CREATOR">Creator · own content & media</option>
              <option value="ADMIN">Admin · workspace administration</option>
            </select>
          </label>
          <button className="button button--primary" disabled={busy}>
            <Plus size={16} />
            Create user
          </button>
        </form>
      </section>
      <section className="panel section-gap">
        <div className="panel__heading">
          <div>
            <h2>The people behind the stories</h2>
            <p>Account roles and access.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>EMAIL</th>
                <th>ROLE</th>
                <th>JOINED</th>
                <th>ACCESS</th>
              </tr>
            </thead>
            <tbody>
              {users.data?.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.email}</strong>
                    {currentUser.id === user.id && <small className="table-sub">You</small>}
                  </td>
                  <td>
                    <select
                      aria-label={`Role for ${user.email}`}
                      value={user.role}
                      disabled={busy || user.id === currentUser.id}
                      onChange={(e) =>
                        void change(user, { role: e.target.value as 'ADMIN' | 'CREATOR' })
                      }
                    >
                      <option>CREATOR</option>
                      <option>ADMIN</option>
                    </select>
                  </td>
                  <td>{dateText(user.created_at)}</td>
                  <td>
                    <button
                      className={`badge ${user.is_active ? 'badge--published' : 'badge--archived'}`}
                      disabled={busy || user.id === currentUser.id}
                      onClick={() => void change(user, { is_active: !user.is_active })}
                    >
                      {user.is_active ? 'Active · disable' : 'Inactive · enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager offset={offset} length={users.data?.length ?? 0} onChange={setOffset} />
      </section>
    </>
  );
}
