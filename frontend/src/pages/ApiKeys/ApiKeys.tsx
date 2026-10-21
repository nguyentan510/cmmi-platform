import { useCallback, useState, type FormEvent } from 'react';
import { Check, Copy, KeyRound, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Drawer, Empty, ErrorBox, Modal } from '../../components/Shared';
import { type Api, type Key, dateText, errorMessage, result } from '../../services/api';
import { useLoad } from '../../services/useLoad';

export default function ApiKeys({ api, isAdmin = false }: { api: Api; isAdmin?: boolean }) {
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [scopes, setScopes] = useState([
    'contents:read',
    'contents:write',
    'media:read',
    'media:write',
  ]);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [createError, setCreateError] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const keys = useLoad(() => result(api.GET('/api/v1/api-keys')), [api]);

  const close = useCallback(() => {
    setSecret(null);
    setCopied(false);
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setCreateError('');
    try {
      const key = await result(
        api.POST('/api/v1/api-keys', {
          body: { name, scopes, expires_at: expiry ? new Date(expiry).toISOString() : null },
        }),
      );
      setIsDrawerOpen(false);
      setSecret(key.key);
      try {
        sessionStorage.setItem('cmmi_last_api_key', key.key);
      } catch {
        // ignore storage access errors
      }
      setName('');
      setExpiry('');
      keys.reload();
    } catch (e) {
      setCreateError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(key: Key) {
    if (
      !window.confirm(
        `Revoke “${key.name}”? Any automation using this key will lose access immediately.`,
      )
    )
      return;
    setError('');
    try {
      await result(
        api.DELETE('/api/v1/api-keys/{key_id}', { params: { path: { key_id: key.id } } }),
      );
      keys.reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const available = [
    'contents:read',
    'contents:write',
    'media:read',
    'media:write',
    'keys:read',
    'keys:write',
    ...(isAdmin ? ['users:read', 'users:write', 'settings:read', 'settings:write'] : []),
  ];

  return (
    <>
      <div className="info-banner">
        <ShieldCheck size={24} />
        <div>
          <strong>The right access. Nothing more.</strong>
          <p>
            Give each automation its own key and only the permissions it needs. Secrets are shown
            just once.
          </p>
        </div>
      </div>
      <ErrorBox message={error || keys.error} />

      <section className="panel">
        <div className="panel__heading">
          <div>
            <h2>
              Your connections <span className="count">{keys.data?.length ?? 0}</span>
            </h2>
            <p>
              {isAdmin ? 'API keys across the workspace.' : 'Keys you have created for your tools.'}
            </p>
          </div>
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              setIsDrawerOpen(true);
              setCreateError('');
            }}
          >
            <Plus size={16} />
            New API key
          </button>
        </div>

        {keys.loading ? (
          <div className="loading">Loading connections…</div>
        ) : keys.data?.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>NAME / PREFIX</th>
                  <th>SCOPES</th>
                  <th>LAST USED</th>
                  <th>EXPIRES</th>
                  <th>STATUS</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {keys.data.map((key) => (
                  <tr key={key.id}>
                    <td>
                      <strong>{key.name}</strong>
                      <small className="table-sub">
                        <code>{key.key_prefix}…</code>
                      </small>
                    </td>
                    <td>
                      <div className="scope-tags">
                        {key.scopes.map((s) => (
                          <code key={s}>{s}</code>
                        ))}
                      </div>
                    </td>
                    <td>{dateText(key.last_used_at)}</td>
                    <td>{dateText(key.expires_at)}</td>
                    <td>
                      <span
                        className={`badge ${key.is_active ? 'badge--published' : 'badge--archived'}`}
                      >
                        {!key.is_active
                          ? 'Revoked'
                          : key.expires_at && new Date(key.expires_at) <= new Date()
                            ? 'Expired'
                            : 'Active'}
                      </span>
                    </td>
                    <td>
                      {key.is_active && (
                        <button aria-label={`Revoke ${key.name}`} onClick={() => void revoke(key)}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Ready to connect">
            Create a key to connect an AI agent, script or publishing workflow.
          </Empty>
        )}
      </section>

      {isDrawerOpen && (
        <Drawer
          title="Create a connection"
          eyebrow="INTEGRATION"
          onClose={() => {
            if (!busy) setIsDrawerOpen(false);
          }}
          initialWidth={580}
          minWidth={400}
          storageKey="cmmi_drawer_apikey_width"
        >
          <form className="drawer-form" onSubmit={create}>
            <div className="drawer-intro">
              <KeyRound size={22} className="drawer-intro__icon" />
              <div>
                <h3>Generate API Key</h3>
                <p>
                  Create a dedicated key for an automation, script, or AI agent.
                  Give each integration only the exact permissions it needs.
                </p>
              </div>
            </div>

            <ErrorBox message={createError} />

            <div className="form-grid">
              <label>
                Key name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Publishing assistant"
                  maxLength={100}
                  required
                  autoFocus
                />
              </label>
              <label>
                Expires at · optional
                <input
                  type="datetime-local"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                />
              </label>
            </div>

            <fieldset>
              <legend>
                Permissions <small>Select the smallest set your workflow needs.</small>
              </legend>
              <div className="scope-grid">
                {available.map((scope) => (
                  <label key={scope} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope)}
                      onChange={(e) =>
                        setScopes((previous) =>
                          e.target.checked
                            ? [...previous, scope]
                            : previous.filter((s) => s !== scope),
                        )
                      }
                    />
                    {scope}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="modal__actions drawer__actions">
              <button
                type="button"
                className="button button--secondary"
                disabled={busy}
                onClick={() => setIsDrawerOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button button--primary"
                disabled={busy || !scopes.length}
              >
                <Plus size={16} />
                {busy ? 'Creating…' : 'Create key'}
              </button>
            </div>
          </form>
        </Drawer>
      )}

      {secret && (
        <Modal title="Your new API key" onClose={close}>
          <div className="settings-form">
            <p>Copy this key now. You won't be able to see it again.</p>
            <div className="secret">
              <code>{secret}</code>
              <button
                aria-label="Copy key"
                onClick={() => {
                  if (!navigator.clipboard) {
                    setError('Select and copy the key manually.');
                    return;
                  }
                  void navigator.clipboard
                    .writeText(secret)
                    .then(() => setCopied(true))
                    .catch(() =>
                      setError('Clipboard unavailable. Select and copy the key manually.'),
                    );
                }}
              >
                {copied ? <Check size={19} /> : <Copy size={19} />}
              </button>
            </div>
            <p className="caption">Store it securely. Send it in the X-API-Key header.</p>
            <button className="button button--primary" onClick={close}>
              I saved this key
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
