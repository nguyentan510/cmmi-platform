import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Layers3, ShieldCheck } from 'lucide-react';
import { type User, errorMessage, makeApi, result } from '../../services/api';
import { ErrorBox } from '../../components/Shared';
import styles from './Login.module.scss';

export default function Login({ onLogin }: { onLogin: (token: string, user: User) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const token = await result(
        makeApi().POST('/api/v1/auth/login', { body: { email, password } }),
      );
      const user = await result(makeApi(token.access_token).GET('/api/v1/auth/me'));
      onLogin(token.access_token, user);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.login}>
      <section className={styles.story}>
        <a className="brand" href="/">
          <span className="brand__mark">
            c<span>·</span>
          </span>
          cmmi<span className="brand__tag">STUDIO</span>
        </a>
        <div>
          <span className="eyebrow">A LITTLE MORE SPACE TO CREATE</span>
          <h1>
            Good stories.
            <br />
            Beautifully
            <br />
            <em>organized.</em>
          </h1>
          <p>
            Your content, media and publishing workflows.
            <br />
            One thoughtful workspace.
          </p>
          <div className={styles.art}>
            <div>
              <Layers3 size={55} strokeWidth={1} />
              <span>
                Make room for
                <br />
                your next idea.
              </span>
              <ArrowUpRight size={30} />
            </div>
            <span className={styles.orbit} />
          </div>
        </div>
        <footer>
          CONTENT & MEDIA MANAGEMENT INFRASTRUCTURE <span>01 / YOUR WORKSPACE</span>
        </footer>
      </section>
      <section className={styles.form}>
        <form onSubmit={submit}>
          <span className="eyebrow">WELCOME TO YOUR WORKSPACE</span>
          <h2>A fresh start.</h2>
          <p>Sign in to bring your next story to life.</p>
          <ErrorBox message={error} />
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
            />
          </label>
          <button className="button button--primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
            <ArrowUpRight size={18} />
          </button>
          <small>
            <ShieldCheck size={15} />
            Private workspace · Access managed by your administrator
          </small>
        </form>
        <footer>
          CMMI v0.1 <span>Designed for the work behind the story.</span>
        </footer>
      </section>
    </div>
  );
}
