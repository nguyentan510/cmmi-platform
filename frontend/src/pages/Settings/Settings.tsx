import { useEffect, useState, type FormEvent } from 'react';
import { Clock3, Database, Leaf, Play, Save } from 'lucide-react';
import { ErrorBox } from '../../components/Shared';
import {
  type Api,
  type SettingInput,
  dateText,
  errorMessage,
  formatBytes,
  result,
} from '../../services/api';
import { useLoad } from '../../services/useLoad';

export default function Settings({ api }: { api: Api }) {
  const setting = useLoad(() => result(api.GET('/api/v1/settings/cleanup')), [api]);
  const [form, setForm] = useState<SettingInput>({
    auto_clean_media: true,
    retention_days: 7,
    cron_expression: '0 2 * * *',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (setting.data) {
      const s = setting.data;
      setForm({
        auto_clean_media: s.auto_clean_media,
        retention_days: s.retention_days,
        cron_expression: s.cron_expression,
      });
    }
  }, [setting.data]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await result(api.PUT('/api/v1/settings/cleanup', { body: form }));
      setMessage('Settings saved. Your cleanup schedule has been updated.');
      setting.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function clean() {
    if (
      !window.confirm(
        'Delete expired media from R2 now? Files cannot be recovered; shared and recent references are protected.',
      )
    )
      return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await result(api.POST('/api/v1/settings/cleanup/trigger'));
      setMessage(
        r.skipped
          ? 'Cleanup is disabled. Enable it to run the retention policy.'
          : `${r.deleted_count} deleted · ${r.failed_count} failed. Metadata has been retained.`,
      );
      setting.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="stats-grid stats-grid--three">
        <article className="stat stat--mint">
          <div>
            <span>Active registered storage</span>
            <Database size={18} />
          </div>
          <strong>{formatBytes(setting.data?.active_storage_bytes ?? 0)}</strong>
          <small>{setting.data?.active_media_count ?? 0} confirmed assets</small>
        </article>
        <article className="stat stat--sand">
          <div>
            <span>Last cleanup</span>
            <Clock3 size={18} />
          </div>
          <strong className="stat__date">{dateText(setting.data?.last_run_at)}</strong>
          <small>Recorded in UTC · displayed in local time</small>
        </article>
        <article className="stat stat--lilac">
          <div>
            <span>Files released last run</span>
            <Leaf size={18} />
          </div>
          <strong>{setting.data?.last_deleted_count ?? 0}</strong>
          <small>Metadata is always retained</small>
        </article>
      </div>
      <ErrorBox message={error || setting.error} />
      {message && (
        <div className="notice notice--success" role="status">
          {message}
        </div>
      )}
      <section className="panel">
        <div className="panel__heading">
          <div>
            <h2>A lighter library, automatically.</h2>
            <p>Keep what you need. Make room for what's next.</p>
          </div>
          <Leaf size={25} strokeWidth={1.3} />
        </div>
        {setting.loading && !setting.data ? (
          <div className="loading">Loading your preferences…</div>
        ) : (
          <form onSubmit={save} className="settings-form">
            <label className="toggle-label">
              <span>
                <strong>Automatically clean published media</strong>
                <small>
                  Release storage after the retention period, without losing your content history.
                </small>
              </span>
              <input
                role="switch"
                type="checkbox"
                checked={form.auto_clean_media}
                onChange={(e) => setForm({ ...form, auto_clean_media: e.target.checked })}
              />
            </label>
            <div className="form-grid">
              <label>
                Retention days
                <input
                  aria-label="Retention days"
                  type="number"
                  min={1}
                  max={365}
                  required
                  value={form.retention_days}
                  onChange={(e) => setForm({ ...form, retention_days: Number(e.target.value) })}
                />
                <small>Days after publication · between 1 and 365.</small>
              </label>
              <label>
                Cron expression · UTC
                <input
                  required
                  value={form.cron_expression}
                  onChange={(e) => setForm({ ...form, cron_expression: e.target.value })}
                  placeholder="0 2 * * *"
                />
                <small>
                  Minute, hour, day, month, weekday. Default: 02:00 UTC (09:00 Vietnam).
                </small>
              </label>
            </div>
            <div className="info-banner">
              <Leaf size={21} />
              <p>
                Shared files stay safe while attached to drafts, scheduled stories, archived stories
                or recent publications. Only confirmed deletions release their URLs.
              </p>
            </div>
            <button className="button button--primary" disabled={busy || !!setting.error}>
              <Save size={16} />
              {busy ? 'Working…' : 'Save settings'}
            </button>
          </form>
        )}
      </section>
      <section className="panel section-gap">
        <div className="panel__heading">
          <div>
            <h2>On your schedule</h2>
            <p>Run the saved retention policy now. Physical file deletion is permanent.</p>
          </div>
          <button
            className="button button--secondary"
            disabled={busy || !setting.data || !!setting.error}
            onClick={() => void clean()}
          >
            <Play size={15} />
            Run cleanup now
          </button>
        </div>
      </section>
      <p className="caption">
        Storage totals cover confirmed assets registered in CMMI. They do not include unregistered
        or incomplete R2 uploads.
      </p>
    </>
  );
}
