import { useEffect, useState, type FormEvent } from 'react';
import { Clock3, Database, KeyRound, Leaf, Play, Save, Users as UsersIcon } from 'lucide-react';
import { ErrorBox } from '../../components/Shared';
import {
  type Api,
  type SettingInput,
  type User,
  dateText,
  errorMessage,
  formatBytes,
  result,
} from '../../services/api';
import { useLoad } from '../../services/useLoad';
import ApiKeys from '../ApiKeys/ApiKeys';
import UserManager from '../Users/Users';

export type SettingsTab = 'cleanup' | 'keys' | 'users';

export default function Settings({
  api,
  currentUser,
  activeTab = 'cleanup',
  onTabChange,
}: {
  api: Api;
  currentUser?: User;
  activeTab?: SettingsTab;
  onTabChange?: (tab: SettingsTab) => void;
}) {
  const [internalTab, setInternalTab] = useState<SettingsTab>(activeTab);
  const currentTab = onTabChange ? activeTab : internalTab;

  function switchTab(tab: SettingsTab) {
    if (onTabChange) onTabChange(tab);
    else setInternalTab(tab);
  }

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
    <div className="settings-hub">
      {/* Settings Navigation Sub-Tabs */}
      <div className="settings-tabs-bar">
        <button
          type="button"
          className={currentTab === 'cleanup' ? 'settings-tab settings-tab--active' : 'settings-tab'}
          onClick={() => switchTab('cleanup')}
        >
          <Leaf size={15} />
          Lưu trữ & Dọn dẹp
        </button>
        <button
          type="button"
          className={currentTab === 'keys' ? 'settings-tab settings-tab--active' : 'settings-tab'}
          onClick={() => switchTab('keys')}
        >
          <KeyRound size={15} />
          API keys
        </button>
        {currentUser?.role === 'ADMIN' && (
          <button
            type="button"
            className={currentTab === 'users' ? 'settings-tab settings-tab--active' : 'settings-tab'}
            onClick={() => switchTab('users')}
          >
            <UsersIcon size={15} />
            Users
          </button>
        )}
      </div>

      {/* Tab: API Keys */}
      {currentTab === 'keys' && (
        <ApiKeys api={api} isAdmin={currentUser?.role === 'ADMIN'} />
      )}

      {/* Tab: Users */}
      {currentTab === 'users' && currentUser && (
        <UserManager api={api} currentUser={currentUser} />
      )}

      {/* Tab: Retention & Storage Cleanup */}
      {currentTab === 'cleanup' && (
        <>
          <div className="stats-grid stats-grid--three compact-stats">
            <article className="stat stat--mint">
              <div>
                <span>Dung lượng đã đăng ký</span>
                <Database size={16} />
              </div>
              <strong>{formatBytes(setting.data?.active_storage_bytes ?? 0)}</strong>
              <small>{setting.data?.active_media_count ?? 0} tệp đã xác nhận</small>
            </article>
            <article className="stat stat--sand">
              <div>
                <span>Lần dọn dẹp gần nhất</span>
                <Clock3 size={16} />
              </div>
              <strong className="stat__date">{dateText(setting.data?.last_run_at)}</strong>
              <small>Theo giờ UTC (hệ thống)</small>
            </article>
            <article className="stat stat--lilac">
              <div>
                <span>Tệp giải phóng đợt trước</span>
                <Leaf size={16} />
              </div>
              <strong>{setting.data?.last_deleted_count ?? 0}</strong>
              <small>Metadata luôn được giữ</small>
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
                <h2>Tự động dọn dẹp thư viện</h2>
                <p>Giải phóng dung lượng R2 định kỳ cho các bài viết đã xuất bản.</p>
              </div>
              <Leaf size={22} strokeWidth={1.3} />
            </div>
            {setting.loading && !setting.data ? (
              <div className="loading">Đang tải cấu hình…</div>
            ) : (
              <form onSubmit={save} className="settings-form">
                <label className="toggle-label">
                  <span>
                    <strong>Tự động xóa media sau khi đăng</strong>
                    <small>
                      Thu hồi dung lượng R2 sau thời gian lưu trữ (retention), không mất lịch sử bài viết.
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
                    <small>Số ngày giữ file sau khi đăng (1 – 365).</small>
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
                      Phút, giờ, ngày, tháng, thứ. Mặc định 02:00 UTC (09:00 Việt Nam).
                    </small>
                  </label>
                </div>
                <div className="info-banner">
                  <Leaf size={20} />
                  <p>
                    File media dùng chung trong bản nháp, bài lên lịch, bài lưu trữ hoặc bài mới đăng luôn được bảo vệ an toàn.
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
                <h2>Chạy dọn dẹp thủ công</h2>
                <p>Kích hoạt chính sách dọn dẹp ngay lập tức mà không cần đợi cron.</p>
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
        </>
      )}
    </div>
  );
}
