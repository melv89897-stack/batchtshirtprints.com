// Shared credit metering client for the three BulkBatch generator tools.
// Loaded by each tool's HTML after its own script — see the small inline
// wiring block appended near the end of each tool file, which wraps that
// tool's existing downloadOne()/#zipBtn export functions with a call into
// BulkBatch.consumeCredits() before letting the (untouched) original export run.
(function () {
  const BulkBatch = (window.BulkBatch = window.BulkBatch || {});

  async function fetchMe() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      return await res.json();
    } catch (e) {
      return { user: null };
    }
  }

  function renderBadge(usage, limits, planFallback) {
    let badge = document.getElementById('batch-credit-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'batch-credit-badge';
      badge.style.cssText =
        'position:fixed;top:14px;right:14px;z-index:99999;background:#161020;' +
        'border:1px solid #2E2342;color:#F4EFFF;padding:10px 16px;border-radius:12px;' +
        'font-family:"Space Grotesk",system-ui,sans-serif;font-size:13px;' +
        'box-shadow:0 8px 24px rgba(0,0,0,.45);display:flex;align-items:center;gap:10px;';
      document.body.appendChild(badge);
    }
    const used = usage ? usage.printsUsed : 0;
    const total = limits ? limits.monthlyPrints : '?';
    const planName = limits ? limits.name : planFallback || 'Free';
    badge.innerHTML =
      '<span>' + planName + ' plan &middot; <b>' + used + '/' + total + '</b> prints used</span>' +
      '<a href="/dashboard" style="color:#B14DFF;text-decoration:none;font-weight:600">Manage</a>';
  }

  BulkBatch.init = async function () {
    const data = await fetchMe();
    if (!data.user) {
      window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
      return;
    }
    renderBadge(data.usage, data.limits, data.user.plan);
  };

  // Returns true if the export may proceed, false if it was blocked (limit
  // reached, not logged in, or a network error) — caller must not proceed
  // with the already-rendered download/ZIP when this returns false.
  BulkBatch.consumeCredits = async function (count) {
    if (!Number.isFinite(count) || count < 1) return false;
    try {
      const res = await fetch('/api/usage/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ count }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
        return false;
      }
      if (!res.ok) {
        if (data.usage && data.limits) renderBadge(data.usage, data.limits);
        window.alert(data.error || 'Could not complete export — please try again.');
        return false;
      }

      renderBadge(data.usage, data.limits);
      return true;
    } catch (e) {
      window.alert('Network error — please check your connection and try again.');
      return false;
    }
  };

  document.addEventListener('DOMContentLoaded', BulkBatch.init);
})();
