import { useEffect, useState } from 'react';
import { COMPANY, telHref } from '../company.js';

const post = async (path, body) => {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error || 'Something went wrong. Please try again.');
  return b;
};

// Login / Sign up / Forgot password — modelled on the SolaX Cloud login.
export default function Login({ onLoggedIn }) {
  const [view, setView] = useState('login');
  return (
    <div className="auth">
      <div className="auth-top">
        <img src="/voltra-logo.png" alt="Voltra" width="118" height="52" />
      </div>
      <div key={view} className="auth-card">
        {view === 'login' && <LoginForm onLoggedIn={onLoggedIn} go={setView} />}
        {view === 'signup' && <Identity go={setView} />}
        {view.startsWith('signup:') && <SignupForm identity={view.slice(7)} onLoggedIn={onLoggedIn} go={setView} />}
        {view === 'forgot' && <Forgot go={setView} onLoggedIn={onLoggedIn} />}
      </div>
      <p className="auth-foot">© {new Date().getFullYear()} Voltra Energy · Data from SolaX Cloud</p>
    </div>
  );
}

function LoginForm({ onLoggedIn, go }) {
  const [f, setF] = useState(() => ({ login: safeGet('voltra.lastLogin') || '', password: '', remember: true, agree: !!safeGet('voltra.lastLogin') }));
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!f.agree) return setErr('Please read and accept the Privacy Policy and User Terms.');
    setBusy(true); setErr(null);
    try {
      const { user } = await post('/api/auth/login', f);
      safeSet('voltra.lastLogin', f.remember ? f.login : '');
      onLoggedIn(user);
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="auth-hello">Hello !</h1>
      <p className="auth-welcome">Welcome To Voltra</p>
      <Field icon="user" label="User name/Email/Mobile number">
        <input autoComplete="username" placeholder="Please enter your email/mobile number" value={f.login}
          onChange={(e) => setF({ ...f, login: e.target.value })} required />
      </Field>
      <Field icon="lock" label="Password">
        <PasswordInput autoComplete="current-password" value={f.password} onChange={(v) => setF({ ...f, password: v })} placeholder="Enter Password" />
      </Field>
      <div className="auth-row">
        <label className="check"><input type="checkbox" checked={f.remember} onChange={(e) => setF({ ...f, remember: e.target.checked })} /><span>Remember Me</span></label>
        <button type="button" className="link" onClick={() => go('forgot')}>Forgot password?</button>
      </div>
      {err && <p className="auth-err" role="alert">{err}</p>}
      <button className="btn auth-btn" disabled={busy}>{busy ? 'Logging in…' : 'Login'}</button>
      <Agree checked={f.agree} onChange={(v) => setF({ ...f, agree: v })} />
      <p className="auth-switch">No Account? <button type="button" className="link" onClick={() => go('signup')}>Sign Up</button></p>
    </form>
  );
}

// Step 1 of sign-up, as in SolaX: "Please choose your identity".
const IDENTITIES = [
  { id: 'end_user', title: 'End User', desc: 'Residential plant users', art: 'home' },
  { id: 'distributor', title: 'Distributor', desc: 'Develop downstream partners & users who also provide power plant installation/O&M services for owners', art: 'grid' },
  { id: 'installer', title: 'Installer', desc: 'Users who provide services to owners', art: 'tools' },
];

function Identity({ go }) {
  const [pick, setPick] = useState(null);
  return (
    <div>
      <button type="button" className="auth-back" onClick={() => go('login')}>‹ Back</button>
      <h1 className="auth-hello identity-title">Please choose your identity</h1>
      <div className="identity-list">
        {IDENTITIES.map((it, i) => (
          <button key={it.id} type="button" className={pick === it.id ? 'identity on' : 'identity'} style={{ animationDelay: `${i * 70}ms` }}
            onClick={() => setPick(it.id)} aria-pressed={pick === it.id}>
            <span className="identity-text"><b>{it.title}</b><span>{it.desc}</span></span>
            <IdentityArt kind={it.art} />
          </button>
        ))}
      </div>
      <button className="btn auth-btn" disabled={!pick} onClick={() => go(`signup:${pick}`)}>Confirm</button>
    </div>
  );
}

function IdentityArt({ kind }) {
  const box = (x, y, c = '#e8edf2', top = '#f7f9fb') => (
    <g key={`${x}${y}`}><path d={`M${x} ${y}l9 -5 9 5 -9 5z`} fill={top} stroke="#d5dce3" strokeWidth=".6" />
      <path d={`M${x} ${y}v8l9 5v-8z`} fill={c} /><path d={`M${x + 18} ${y}v8l-9 5v-8z`} fill="#dfe5eb" /></g>
  );
  return (
    <svg className="identity-art" width="64" height="56" viewBox="0 0 64 56" aria-hidden="true">
      {kind === 'home' && <>{box(14, 22)}{box(32, 22)}<path d="M23 12l9-6 9 6-9 5z" fill="#1baf7a" opacity=".85" />{box(23, 30)}</>}
      {kind === 'grid' && [[6, 20], [24, 20], [42, 20], [15, 30], [33, 30], [24, 40]].map(([x, y]) => box(x, y, x === 24 && y === 20 ? '#bfe9dc' : '#e8edf2'))}
      {kind === 'tools' && <>{[[10, 24], [28, 24], [19, 34], [37, 34]].map(([x, y]) => box(x, y, x === 28 ? '#bfe9dc' : '#e8edf2'))}</>}
    </svg>
  );
}

function SignupForm({ identity, onLoggedIn, go }) {
  const business = identity === 'installer' || identity === 'distributor';
  const [f, setF] = useState({ identity, name: '', company: '', zip: '', orgNo: '', phone: '', login: '', code: '', password: '', confirm: '', inverterSn: '', registerNo: '', agree: false });
  const [sent, setSent] = useState(null);
  const [notice, setNotice] = useState(business); // SolaX shows a "User Notice" when a business form opens
  const [orgHelp, setOrgHelp] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: typeof e === 'string' ? e : e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (f.password !== f.confirm) return setErr('Passwords do not match.');
    if (!f.agree) return setErr('Please read and accept the Privacy Policy and User Terms.');
    setBusy(true); setErr(null);
    try {
      const { confirm, ...body } = f;
      const { user } = await post('/api/auth/register', body);
      safeSet('voltra.lastLogin', f.login);
      onLoggedIn(user);
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }

  return (
    <form onSubmit={submit} noValidate>
      <button type="button" className="auth-back" onClick={() => go('signup')} aria-label="Back">‹ {IDENTITIES.find((x) => x.id === identity)?.title}</button>
      <h1 className="auth-hello">Create account</h1>
      <p className="auth-welcome">{business ? 'Monitor the systems you install and service' : 'Link your Voltra system to see it in the app'}</p>
      {business && <>
        <Field icon="device" label="Company Name" required><input autoComplete="organization" value={f.company} onChange={set('company')} placeholder="Please Enter" /></Field>
        {identity === 'installer' && <Field icon="mail" label="Zip Code" required><input autoComplete="postal-code" inputMode="numeric" value={f.zip} onChange={set('zip')} placeholder="Please Enter" /></Field>}
        <Field icon="device" label={<>Distributor Organization Number <button type="button" className="help-dot" onClick={() => setOrgHelp((v) => !v)} aria-label="What is this?">?</button></>} required={identity === 'distributor'}>
          <input value={f.orgNo} onChange={set('orgNo')} placeholder={identity === 'distributor' ? 'Number of your superior channel partner' : 'Optional: your distributor\'s number'} autoCapitalize="characters" />
        </Field>
        {orgHelp && <p className="org-help">Ask your superior channel partner for their Organization Number (shown in their Voltra app under Me). {identity === 'installer' ? 'Leave empty if you work directly with Voltra.' : 'If you work directly with Voltra, ask Voltra for its number.'}</p>}
      </>}
      <Field icon="user" label={business ? 'Contact Person' : 'Full name'}><input autoComplete="name" value={f.name} onChange={set('name')} placeholder={business ? 'Please Enter' : 'Your name'} /></Field>
      {business && <Field icon="mail" label="Phone Number"><input autoComplete="tel" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="+91 Please Enter" /></Field>}
      <Field icon="mail" label="E-Mail Address" required>
        <span className="code-row">
          <input autoComplete="email" type="email" value={f.login} onChange={set('login')} placeholder="Enter Your Email" />
          <SendCodeButton email={f.login} purpose="signup" onSent={setSent} onError={setErr} />
        </span>
      </Field>
      {sent && <p className="code-sent">Code sent to {sent.sentTo} from no-reply@voltra.in.{sent.devCodes ? ' (Test mode: email is not set up yet — the code is in the server log.)' : ' Not in your inbox within a minute? Check Spam and Promotions. The code works for 10 minutes.'}</p>}
      <Field icon="shield" label="Verification Code" required>
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={f.code} onChange={set('code')} placeholder="6-digit code from the e-mail" />
      </Field>
      <Field icon="lock" label="Password"><PasswordInput autoComplete="new-password" value={f.password} onChange={set('password')} placeholder="At least 8 characters, letters + numbers" /></Field>
      <Field icon="lock" label="Confirm password"><PasswordInput autoComplete="new-password" value={f.confirm} onChange={set('confirm')} placeholder="Re-enter password" /></Field>

      {business ? (
        <div className="auth-section">
          <b>Approval by Voltra</b>
          <span className="muted">Business accounts are checked by Voltra before use. After approval you can add the systems you install.</span>
        </div>
      ) : <>
      <div className="auth-section">
        <b>Your system</b>
        <span className="muted">Both numbers are printed on the labels of your devices. If someone shared their system with your e-mail, leave both empty.</span>
      </div>
      <Field icon="device" label="Inverter SN"><input value={f.inverterSn} onChange={set('inverterSn')} placeholder="14 characters, e.g. H34XXXXXXXXXXX" autoCapitalize="characters" /></Field>
      <Field icon="wifi" label="Registration No. (on the WiFi dongle)"><input value={f.registerNo} onChange={set('registerNo')} placeholder="10 characters, e.g. SXXXXXXXXX" autoCapitalize="characters" /></Field>
      </>}

      {err && <p className="auth-err" role="alert">{err}</p>}
      <button className="btn auth-btn" disabled={busy}>{busy ? 'Creating account…' : 'Sign Up'}</button>
      <Agree checked={f.agree} onChange={(v) => setF({ ...f, agree: v })} />
      <p className="auth-switch">Account already exists? <button type="button" className="link" onClick={() => go('login')}>Login</button></p>
      {notice && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="notice-title">
          <div className="modal">
            <div className="modal-art" aria-hidden="true">🪪</div>
            <h2 id="notice-title">User Notice</h2>
            <p>If your superior channel partner has already registered on this platform, we recommend that you contact the superior channel partner to add it directly.</p>
            <button type="button" className="btn" onClick={() => setNotice(false)}>Confirm</button>
          </div>
        </div>
      )}
    </form>
  );
}

// Forgot password, as in SolaX: account → Next → code to the registered e-mail + new password.
function Forgot({ go, onLoggedIn }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ login: safeGet('voltra.lastLogin') || '', code: '', password: '', confirm: '' });
  const [sent, setSent] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: typeof e === 'string' ? e : e.target.value });

  async function next(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { setSent(await post('/api/auth/forgot', { login: f.login })); setStep(2); } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }
  async function reset(e) {
    e.preventDefault();
    if (f.password !== f.confirm) return setErr('Passwords do not match.');
    setBusy(true); setErr(null);
    try { const { user } = await post('/api/auth/reset-password', f); onLoggedIn(user); }
    catch (e2) { setErr(e2.message); setBusy(false); }
  }

  return step === 1 ? (
    <form onSubmit={next} noValidate>
      <button type="button" className="auth-back" onClick={() => go('login')}>‹ Back</button>
      <h1 className="auth-hello">Forgot password?</h1>
      <p className="auth-welcome">We'll send a verification code to the e-mail address of your account.</p>
      <Field icon="user" label="User name/Email/Mobile number" required>
        <input autoComplete="username" value={f.login} onChange={set('login')} placeholder="Please enter your user name/email/mobile number" />
      </Field>
      {err && <p className="auth-err" role="alert">{err}</p>}
      <button className="btn auth-btn" disabled={busy || !f.login}>{busy ? 'Sending…' : 'Next'}</button>
      <p className="auth-help-line">Can't access your e-mail? Call <a href={telHref(COMPANY.phone)}>{COMPANY.phone}</a> or write to <a href={`mailto:${COMPANY.email}?subject=Password reset`}>{COMPANY.email}</a>.</p>
    </form>
  ) : (
    <form onSubmit={reset} noValidate>
      <button type="button" className="auth-back" onClick={() => { setStep(1); setErr(null); }}>‹ Back</button>
      <h1 className="auth-hello">Reset password</h1>
      <p className="auth-welcome">A verification code was sent to <b>{sent?.sentTo}</b>. Not in your inbox? Check Spam and Promotions.</p>
      {sent?.devCodes && <p className="code-sent">Test mode: email is not set up yet — the code is in the server log.</p>}
      <Field icon="shield" label="Verification Code" required>
        <span className="code-row">
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={f.code} onChange={set('code')} placeholder="6-digit code" />
          <ResendButton login={f.login} onSent={setSent} onError={setErr} />
        </span>
      </Field>
      <Field icon="lock" label="New password" required><PasswordInput autoComplete="new-password" value={f.password} onChange={set('password')} placeholder="At least 8 characters, letters + numbers" /></Field>
      <Field icon="lock" label="Confirm password" required><PasswordInput autoComplete="new-password" value={f.confirm} onChange={set('confirm')} placeholder="Re-enter password" /></Field>
      {err && <p className="auth-err" role="alert">{err}</p>}
      <button className="btn auth-btn" disabled={busy || f.code.length !== 6}>{busy ? 'Saving…' : 'Confirm'}</button>
    </form>
  );
}

// "Send Verification Code" with a 60 s countdown, like SolaX.
function SendCodeButton({ email, purpose, onSent, onError }) {
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!left) return; const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t); }, [left]);
  async function send() {
    setBusy(true); onError(null);
    try { onSent(await post('/api/auth/send-code', { email, purpose })); setLeft(60); } catch (e) { onError(e.message); }
    setBusy(false);
  }
  return (
    <button type="button" className="code-btn" disabled={busy || left > 0 || !email} onClick={send}>
      {left > 0 ? `Resend (${left}s)` : busy ? 'Sending…' : 'Send Verification Code'}
    </button>
  );
}
function ResendButton({ login, onSent, onError }) {
  const [left, setLeft] = useState(60);
  useEffect(() => { if (!left) return; const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t); }, [left]);
  return (
    <button type="button" className="code-btn" disabled={left > 0}
      onClick={async () => { try { onSent(await post('/api/auth/forgot', { login })); setLeft(60); } catch (e) { onError(e.message); } }}>
      {left > 0 ? `Resend (${left}s)` : 'Resend code'}
    </button>
  );
}

// ---------- pieces ----------

const ICONS = {
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  device: <><rect x="4" y="5" width="16" height="12" rx="2" /><path d="M9 21h6M12 17v4" /></>,
  shield: <><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  wifi: <><path d="M3 9.5a13 13 0 0 1 18 0M6 13a8.5 8.5 0 0 1 12 0M9 16.5a4 4 0 0 1 6 0" /><circle cx="12" cy="19.5" r=".8" /></>,
};

function Field({ icon, label, required, children }) {
  return (
    <label className="auth-field">
      <span className="auth-label">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">{ICONS[icon]}</svg>
        {label}{required && <span className="req">*</span>}
      </span>
      {children}
    </label>
  );
}

function PasswordInput({ value, onChange, ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <span className="pw">
      <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
      <button type="button" className="pw-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
          {!show && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </span>
  );
}

function Agree({ checked, onChange }) {
  return (
    <label className="check agree">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>I have read and agree to the <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a> and <a href="/terms.html" target="_blank" rel="noreferrer">User Terms</a></span>
    </label>
  );
}

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* ignore */ } }
