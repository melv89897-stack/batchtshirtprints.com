import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

/** @returns {[string, (to: string) => void]} */
function useRoute() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = useCallback((to) => {
    window.history.pushState({}, '', to);
    setPath(window.location.pathname);
  }, []);
  return [path, navigate];
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

const PLANS = [
  { id: 'free', label: 'Free', price: '$0', prints: 10, blurb: 'Try all three tools.' },
  { id: 'starter', label: 'Starter', price: '$4.99/mo', prints: 100, blurb: 'For steady sellers.' },
  { id: 'pro', label: 'Pro', price: '$9.99/mo', prints: 1000, blurb: 'For high-volume batches.' },
];

export default function App() {
  const [path, navigate] = useRoute();
  const [session, setSession] = useState({ loading: true, user: null, usage: null, limits: null });

  const refreshSession = useCallback(async () => {
    try {
      const data = await api.me();
      setSession({ loading: false, user: data.user, usage: data.usage, limits: data.limits });
    } catch {
      setSession({ loading: false, user: null, usage: null, limits: null });
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (qs('payment') === 'success') refreshSession();
  }, [path, refreshSession]);

  // The 3 design tools are separate static pages (full navigation, not SPA
  // routes). Returning via the browser's back button can restore this page
  // from bfcache without re-running JS, leaving usage/prints-used stale.
  // Re-fetch whenever the tab becomes visible/focused or is restored so the
  // dashboard always reflects prints consumed while the user was on a tool.
  useEffect(() => {
    const onPageShow = (e) => { if (e.persisted) refreshSession(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') refreshSession(); };
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, [refreshSession]);

  // First-time / logged-out visitors go through the Quick Start Guide first
  // instead of landing on the marketing/pricing page. Logged-in users go
  // straight to their dashboard. The marketing page is still reachable at
  // /pricing (linked from the guide).
  useEffect(() => {
    if (session.loading || path !== '/') return;
    if (session.user) {
      window.location.replace('/dashboard');
    } else {
      window.location.replace('/tools/quick-start-guide.html');
    }
  }, [session.loading, session.user, path]);

  const Nav = () => (
    <header className="nav">
      <a href="/" className="brand" onClick={(e) => { e.preventDefault(); navigate('/'); }}>BulkBatch</a>
      <nav>
        <a onClick={(e) => { e.preventDefault(); navigate('/pricing'); }} href="/pricing">Pricing</a>
        {session.user ? (
          <>
            <a onClick={(e) => { e.preventDefault(); navigate('/dashboard'); }} href="/dashboard">Dashboard</a>
            <a onClick={async (e) => { e.preventDefault(); await api.logout(); await refreshSession(); window.location.href = '/tools/quick-start-guide.html'; }} href="#">Log out</a>
          </>
        ) : (
          <>
            <a onClick={(e) => { e.preventDefault(); navigate('/login'); }} href="/login">Log in</a>
            <a className="cta" onClick={(e) => { e.preventDefault(); navigate('/signup'); }} href="/signup">Sign up free</a>
          </>
        )}
      </nav>
    </header>
  );

  let view;
  if (session.loading) {
    view = <div className="loading">Loading…</div>;
  } else if (path === '/login') {
    view = <LoginView navigate={navigate} refreshSession={refreshSession} />;
  } else if (path === '/signup') {
    view = <SignupView navigate={navigate} refreshSession={refreshSession} />;
  } else if (path === '/forgot-password') {
    view = <ForgotPasswordView navigate={navigate} />;
  } else if (path === '/reset-password') {
    view = <ResetPasswordView navigate={navigate} />;
  } else if (path === '/dashboard') {
    view = session.user
      ? <DashboardView session={session} />
      : <LoginView navigate={navigate} refreshSession={refreshSession} next="/dashboard" />;
  } else if (path === '/pricing') {
    view = <LandingView navigate={navigate} session={session} />;
  } else if (path === '/') {
    // Handled by the redirect effect above (guide for logged-out, dashboard
    // for logged-in) — render nothing while that redirect happens.
    view = <div className="loading">Loading…</div>;
  } else {
    view = <LandingView navigate={navigate} session={session} />;
  }

  return (
    <div className="app">
      <Nav />
      <main>{view}</main>
      <footer className="foot">BulkBatch &middot; every export is a transparent 4500&times;5400 PNG, print-ready for Printify, Printful &amp; Etsy.</footer>
    </div>
  );
}

function LandingView({ navigate, session }) {
  return (
    <div className="landing">
      <section className="hero">
        <span className="eyebrow">Bulk Design Studio</span>
        <h1>One idea. <span className="grad">A hundred shirts.</span></h1>
        <p className="sub">Three tools to make print-ready t-shirt designs in bulk — bulk text, pattern-fill, and slogan+graphic remix. Free to start.</p>
        <div className="row">
          <button className="btn primary big" onClick={() => navigate(session.user ? '/dashboard' : '/signup')}>
            {session.user ? 'Go to dashboard' : 'Start free — 10 prints/mo'}
          </button>
          <a className="btn ghost big" href="/tools/quick-start-guide.html">Quick start guide</a>
        </div>
      </section>

      <section className="pricing">
        <h2>Simple pricing</h2>
        <div className="plans">
          {PLANS.map((p) => (
            <div key={p.id} className="plan-card">
              <div className="plan-name">{p.label}</div>
              <div className="plan-price">{p.price}</div>
              <div className="plan-prints">{p.prints} prints / month</div>
              <div className="plan-blurb">{p.blurb}</div>
              <button
                className="btn ghost full"
                onClick={() => navigate(session.user ? '/dashboard' : '/signup')}
              >
                {p.id === 'free' ? 'Start free' : 'Choose ' + p.label}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function LoginView({ navigate, refreshSession, next = undefined }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const target = next || qs('next') || '/dashboard';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.login({ email, password });
      await refreshSession();
      // What-if: `next` points at a static tool page (/tools/*.html) rather
      // than one of this SPA's own client-side routes. navigate() only does
      // a history.pushState — the URL bar would update but the actual page
      // content wouldn't change, since the SPA doesn't recognize that path
      // as one of its routes. Do a real browser navigation for anything
      // outside the SPA's own routes instead.
      if (target.startsWith('/tools/')) {
        window.location.href = target;
      } else {
        navigate(target);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card">
      <h2>Log in</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={submit}>
        <label>Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label>Password</label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn primary full" disabled={busy} type="submit">{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <div className="auth-links">
        <a onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }} href="/forgot-password">Forgot password?</a>
        <a onClick={(e) => { e.preventDefault(); navigate('/signup'); }} href="/signup">Need an account? Sign up</a>
      </div>
    </div>
  );
}

function SignupView({ navigate, refreshSession }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [code, setCode] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api.signup({ name, email, password });
      if (data.verifyCode) {
        setNeedsVerify(true);
      } else {
        await refreshSession();
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitVerify = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.verify({ email, code });
      await refreshSession();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (needsVerify) {
    return (
      <div className="auth-card">
        <h2>Check your email</h2>
        <p className="hint">We sent a 6-digit code to {email}.</p>
        {error && <div className="error">{error}</div>}
        <form onSubmit={submitVerify}>
          <label>Verification code</label>
          <input inputMode="numeric" required value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn primary full" disabled={busy} type="submit">{busy ? 'Verifying…' : 'Verify & continue'}</button>
        </form>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h2>Create your free account</h2>
      <p className="hint">10 prints/month, no card required.</p>
      {error && <div className="error">{error}</div>}
      <form onSubmit={submit}>
        <label>Name</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} />
        <label>Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label>Password</label>
        <input type="password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn primary full" disabled={busy} type="submit">{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <div className="auth-links">
        <a onClick={(e) => { e.preventDefault(); navigate('/login'); }} href="/login">Already have an account? Log in</a>
      </div>
    </div>
  );
}

function ForgotPasswordView({ navigate }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await api.forgotPassword({ email });
      setMessage(data.message);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card">
      <h2>Reset your password</h2>
      {message ? (
        <p className="hint">{message}</p>
      ) : (
        <form onSubmit={submit}>
          <label>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn primary full" disabled={busy} type="submit">{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
      <div className="auth-links">
        <a onClick={(e) => { e.preventDefault(); navigate('/login'); }} href="/login">Back to login</a>
      </div>
    </div>
  );
}

function ResetPasswordView({ navigate }) {
  const token = qs('token') || '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.resetPassword({ token, password });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return <div className="auth-card"><h2>Invalid link</h2><p className="hint">This reset link is missing its token.</p></div>;
  }

  if (done) {
    return (
      <div className="auth-card">
        <h2>Password updated</h2>
        <button className="btn primary full" onClick={() => navigate('/login')}>Log in</button>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h2>Set a new password</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={submit}>
        <label>New password</label>
        <input type="password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn primary full" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </div>
  );
}

function DashboardView({ session }) {
  const { user, usage, limits } = session;
  const [busyPlan, setBusyPlan] = useState(null);
  const [error, setError] = useState('');

  const upgrade = async (plan) => {
    setError('');
    setBusyPlan(plan);
    try {
      const data = await api.checkout(plan);
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setBusyPlan(null);
    }
  };

  const openPortal = async () => {
    setError('');
    try {
      const data = await api.portal();
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
    }
  };

  const used = usage?.printsUsed || 0;
  const total = limits?.monthlyPrints || 0;
  const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;

  return (
    <div className="dashboard">
      <h2>Welcome{user.name ? `, ${user.name}` : ''}</h2>
      {error && <div className="error">{error}</div>}

      <div className="usage-card">
        <div className="usage-top">
          <span>{limits?.name || 'Free'} plan</span>
          <span>{used} / {total} prints this month</span>
        </div>
        <div className="usage-bar"><div className="usage-fill" style={{ width: pct + '%' }} /></div>
        {user.stripeCustomerId && (
          <button className="btn ghost" onClick={openPortal}>Manage billing</button>
        )}
      </div>

      <h3>Your tools</h3>
      <div className="tool-links">
        <a className="tool-link" href="/tools/quick-start-guide.html">Quick Start Guide</a>
        <a className="tool-link" href="/tools/bulk-tshirt-design-studio.html">Bulk Text Generator</a>
        <a className="tool-link" href="/tools/pattern-fill-text-studio.html">Pattern-Fill Studio</a>
        <a className="tool-link" href="/tools/slogan-graphic-studio.html">Slogan + Graphic Remix</a>
      </div>

      {limits?.name !== 'Pro' && (
        <>
          <h3>Upgrade</h3>
          <div className="plans">
            {PLANS.filter((p) => p.id !== 'free' && p.label !== limits?.name).map((p) => (
              <div key={p.id} className="plan-card">
                <div className="plan-name">{p.label}</div>
                <div className="plan-price">{p.price}</div>
                <div className="plan-prints">{p.prints} prints / month</div>
                <button className="btn primary full" disabled={busyPlan === p.id} onClick={() => upgrade(p.id)}>
                  {busyPlan === p.id ? 'Redirecting…' : `Upgrade to ${p.label}`}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
