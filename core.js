/* ===== Market Silo — core: state, utils, router, ribbon, home ===== */
window.MS = (function () {
  const isLocal = location.port === '8017' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const API = '';

  /* ---------- safe storage (cookie-backed, in-memory fallback) ---------- */
  const mem = {};
  const store = {
    get(k) {
      if (k in mem) return mem[k];
      try {
        const m = document.cookie.match('(?:^|; )' + k.replace(/\./g, '\\.') + '=([^;]*)');
        return m ? decodeURIComponent(m[1]) : null;
      } catch (e) { return null; }
    },
    set(k, v) {
      mem[k] = v;
      try { document.cookie = k + '=' + encodeURIComponent(v) + '; path=/; max-age=31536000; samesite=lax'; } catch (e) { /* sandboxed */ }
    }
  };

  /* ---------- state ---------- */
  const state = {
    currency: store.get('ms.cur') || 'USD',
    fx: { USD: 1 },
    fxFailed: [],
    lastUpdate: 0,
    route: '',
    params: {},
    view: null,
    charts: {}
  };

  const CUR_SYM = { USD: '$', PKR: '₨', SAR: 'SR', AED: 'AED', INR: '₹', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', TRY: '₺', CAD: 'C$', AUD: 'A$' };
  const TOLA_G = 11.6638;
  const OZT_G = 31.1034768;
  const PURITY = { '24K': 1, '22K': 0.9167, '21K': 0.875, '18K': 0.75 };

  /* ---------- fetch helper ---------- */
  async function api(path) {
    const res = await fetch(API + path, { headers: { Accept: 'application/json' } });
    let body = null;
    try { body = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok || !body || body.error) throw new Error((body && body.error) || 'request failed (' + res.status + ')');
    return body;
  }

  /* ---------- formatting ---------- */
  const rate = (c) => (state.fx && state.fx[c]) || (c === 'USD' ? 1 : null);

  function conv(usd, cur) {
    cur = cur || state.currency;
    const r = rate(cur);
    if (usd === null || usd === undefined || !isFinite(usd) || r === null) return null;
    return usd * r;
  }

  function nf(v, min, max) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    return v.toLocaleString('en-US', { minimumFractionDigits: min, maximumFractionDigits: max });
  }

  function autoDigits(v) {
    const a = Math.abs(v);
    if (a === 0) return 2;
    if (a < 0.01) return 6;
    if (a < 1) return 4;
    if (a < 1000) return 2;
    return a > 100000 ? 0 : 2;
  }

  /* money: value already in target currency */
  function money(v, cur, digits) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    cur = cur || state.currency;
    const d = digits === undefined ? autoDigits(v) : digits;
    return (CUR_SYM[cur] || '') + nf(v, d, d);
  }

  /* usd -> display currency string */
  function usd(v, digits) {
    const c = conv(v);
    if (c === null) return '—';
    return money(c, state.currency, digits);
  }

  function compact(v, cur) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    const code = cur === undefined || cur === null ? state.currency : cur;
    const sym = CUR_SYM[code] || '';
    const a = Math.abs(v);
    const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    for (const [d, s] of units) if (a >= d) return sym + (v / d).toFixed(2) + s;
    return sym + nf(v, 0, 2);
  }

  function pctText(p) {
    if (p === null || p === undefined || !isFinite(p)) return '—';
    return (p >= 0 ? '+' : '−') + Math.abs(p).toFixed(2) + '%';
  }

  function cls(v) { return v === null || v === undefined || !isFinite(v) ? 'flat' : v > 0 ? 'pos' : v < 0 ? 'neg' : 'flat'; }
  function arrow(v) { return v === null || v === undefined || !isFinite(v) ? '' : v > 0 ? '▲' : v < 0 ? '▼' : '■'; }

  function changeCell(change, pct, digits) {
    const c = cls(pct !== null && pct !== undefined ? pct : change);
    const chg = change === null || change === undefined || !isFinite(change) ? '—'
      : (change >= 0 ? '+' : '−') + nf(Math.abs(change), digits === undefined ? 2 : digits, digits === undefined ? 2 : digits);
    return `<span class="${c}">${arrow(pct !== null ? pct : change)} ${chg}</span>`;
  }

  function pctChip(p) {
    return `<span class="chip ${cls(p)}">${arrow(p)} ${pctText(p)}</span>`;
  }

  const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  /* ---------- states ---------- */
  function skeletonTable(rows, cols) {
    let h = '';
    for (let i = 0; i < (rows || 6); i++) {
      h += '<div class="sk-row">' + Array.from({ length: cols || 5 }).map(() => '<div class="sk"></div>').join('') + '</div>';
    }
    return h;
  }
  function skeletonBlock(h) { return `<div class="sk" style="height:${h || 200}px"></div>`; }

  function errorState(msg, retryId) {
    return `<div class="state">
      <div class="ic"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.4 17.4A2 2 0 0 0 4.1 20.4h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg></div>
      <h3>Couldn't load this data</h3>
      <p>${esc(msg || 'The upstream market data source did not respond.')}</p>
      <button class="btn primary" data-retry="${esc(retryId || '')}">Retry</button>
    </div>`;
  }

  function emptyState(title, msg) {
    return `<div class="state">
      <div class="ic"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/></svg></div>
      <h3>${esc(title)}</h3><p>${esc(msg)}</p></div>`;
  }

  function failNote(failed) {
    if (!failed || !failed.length) return '';
    return `<div class="note"><b>Data unavailable:</b> ${failed.map((f) => esc(f.label || f.symbol)).join(', ')} — the upstream source returned no data for ${failed.length === 1 ? 'this symbol' : 'these symbols'}; ${failed.length === 1 ? 'the row is' : 'those rows are'} hidden.</div>`;
  }

  function icon(name, size) {
    const s = size || 18;
    const paths = {
      stocks: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
      crypto: '<circle cx="12" cy="12" r="9"/><path d="M9 8h4.5a2.5 2.5 0 0 1 0 5H9m0 0h5a2.5 2.5 0 0 1 0 5H9m0-10V6m0 12v2m3-14v2m0 10v2"/>',
      gold: '<path d="M4 8h16l-2 10H6L4 8Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
      metals: '<path d="M12 3l8 4.5v9L12 21 4 16.5v-9L12 3Z"/><path d="M12 3v18M4 7.5l8 4.5 8-4.5"/>',
      indices: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18-3-3-3-15 0-18Z"/>',
      currency: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5A3 3 0 0 0 9 10c0 3 6 2 6 5a3 3 0 0 1-6-.5M12 6v12"/>',
      calc: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
      swap: '<path d="M7 4v13M7 4 4 7M7 4l3 3M17 20V7M17 20l3-3M17 20l-3-3"/>',
      arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
    };
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
  }

  /* ---------- charts ---------- */
  function themeColors() {
    const cs = getComputedStyle(document.documentElement);
    return {
      ink: cs.getPropertyValue('--ink').trim(),
      ink3: cs.getPropertyValue('--ink-3').trim(),
      amber: cs.getPropertyValue('--amber').trim(),
      hair: cs.getPropertyValue('--hair').trim(),
      surface: cs.getPropertyValue('--surface').trim()
    };
  }

  function destroyChart(id) {
    if (state.charts[id]) { try { state.charts[id].destroy(); } catch (e) {} delete state.charts[id]; }
  }

  function lineChart(id, points, opts) {
    const longSpan = points && points.length > 1 && (points[points.length - 1].t - points[0].t) > 400 * 864e5;
    opts = opts || {};
    const el = document.getElementById(id);
    if (!el || !window.Chart) return;
    destroyChart(id);
    const c = themeColors();
    const stroke = opts.color || c.amber;
    const g = el.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, el.parentElement.clientHeight || 260);
    grad.addColorStop(0, hexA(stroke, 0.18));
    grad.addColorStop(1, hexA(stroke, 0));
    const intraday = opts.intraday;
    state.charts[id] = new Chart(g, {
      type: 'line',
      data: {
        labels: points.map((p) => new Date(p.t)),
        datasets: [{
          data: points.map((p) => (opts.convert === false ? p.c : conv(p.c))),
          borderColor: stroke,
          borderWidth: 2,
          fill: true,
          backgroundColor: grad,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: stroke,
          tension: 0.18
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 260 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: c.ink, titleColor: c.surface, bodyColor: c.surface,
            padding: 10, displayColors: false, cornerRadius: 6,
            callbacks: {
              title: (it) => fmtDate(points[it[0].dataIndex].t, intraday),
              label: (it) => (opts.valueFmt ? opts.valueFmt(it.raw) : money(it.raw, state.currency, autoDigits(it.raw)))
            }
          }
        },
        scales: {
          x: { grid: { display: false }, border: { color: c.hair }, ticks: { color: c.ink3, maxTicksLimit: 6, font: { size: 10 }, callback: (v, i) => (points[i] ? (longSpan ? new Date(points[i].t).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : fmtDate(points[i].t, intraday, true)) : '') } },
          y: {
            position: 'right', grid: { color: c.hair, drawTicks: false }, border: { display: false },
            ticks: { color: c.ink3, maxTicksLimit: 5, font: { size: 10 }, callback: (v) => (opts.valueFmt ? opts.valueFmt(v) : money(v, state.currency, autoDigits(v))) }
          }
        }
      }
    });
  }

  function hexA(col, a) {
    if (col.startsWith('#')) {
      const h = col.slice(1);
      const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
      const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    return col;
  }

  function fmtDate(t, intraday, short) {
    const d = new Date(t);
    if (intraday) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + (short ? '' : ' · ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: short ? undefined : 'numeric' });
  }

  function sparkline(canvas, values, up) {
    if (!canvas || !values || values.length < 2 || !window.Chart) return;
    const c = themeColors();
    const col = up === null ? c.ink3 : up ? getComputedStyle(document.documentElement).getPropertyValue('--pos').trim() : getComputedStyle(document.documentElement).getPropertyValue('--neg').trim();
    new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels: values.map((_, i) => i), datasets: [{ data: values, borderColor: col, borderWidth: 1.4, pointRadius: 0, fill: false, tension: 0.3 }] },
      options: {
        responsive: false, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
        elements: { line: { borderJoinStyle: 'round' } }
      }
    });
  }

  /* ---------- FX ---------- */
  async function loadFx() {
    try {
      const j = await api('/api/fx');
      state.fx = j.rates || { USD: 1 };
      state.fxFailed = j.failed || [];
    } catch (e) {
      state.fx = { USD: 1 };
      state.fxFailed = [{ symbol: 'FX rates', error: String(e.message || e) }];
    }
  }

  /* ---------- ribbon ---------- */
  async function loadRibbon() {
    const track = document.getElementById('ribbon-track');
    if (!track) return;
    if (!track.children.length) {
      track.innerHTML = Array.from({ length: 8 }).map(() => '<div class="tick"><span class="sk" style="width:110px"></span></div>').join('');
    }
    try {
      const j = await api('/api/ribbon');
      if (!j.items || !j.items.length) throw new Error('no ribbon data');
      const html = j.items.map((it) => {
        let val;
        if (it.kind === 'index') val = nf(it.price, 2, 2);
        else if (it.kind === 'rate') val = nf(it.price, 2, 4);
        else val = usd(it.price, autoDigits(conv(it.price) || 0));
        return `<div class="tick"><span class="lbl">${esc(it.label)}</span><span class="val num">${val}</span><span class="${cls(it.changePct)} num">${arrow(it.changePct)} ${pctText(it.changePct)}</span></div>`;
      }).join('');
      track.innerHTML = html + html;
    } catch (e) {
      track.innerHTML = `<div class="tick"><span class="lbl">Live ribbon unavailable</span><span class="val">—</span></div>`;
    }
  }

  /* ---------- updated indicator ---------- */
  function touchUpdate() { state.lastUpdate = Date.now(); paintUpdated(); }
  function paintUpdated() {
    const el = document.getElementById('updated-txt');
    if (!el) return;
    if (!state.lastUpdate) { el.textContent = 'loading…'; return; }
    const s = Math.round((Date.now() - state.lastUpdate) / 1000);
    el.textContent = s < 5 ? 'updated just now' : `updated ${s < 90 ? s + 's' : Math.round(s / 60) + 'm'} ago`;
  }

  /* ---------- router ---------- */
  const views = {};

  function parseHash() {
    const h = (location.hash || '#/').replace(/^#/, '');
    const [p, qs] = h.split('?');
    const params = {};
    new URLSearchParams(qs || '').forEach((v, k) => { params[k] = v; });
    const name = (p.replace(/^\/+|\/+$/g, '') || 'home');
    return { name, params };
  }

  async function route() {
    const { name, params } = parseHash();
    const v = views[name] || views.home;
    state.route = views[name] ? name : 'home';
    state.params = params;
    Object.keys(state.charts).forEach(destroyChart);
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.r === state.route));
    const el = document.getElementById('view');
    el.innerHTML = '';
    window.scrollTo({ top: 0, behavior: 'auto' });
    state.view = v;
    try { await v.render(el, params); } catch (e) {
      el.innerHTML = `<div class="card" style="margin-top:20px">${errorState(String(e.message || e), 'route')}</div>`;
    }
    touchUpdate();
  }

  function refreshCurrent() {
    if (state.view && state.view.refresh) { state.view.refresh(); }
    else { route(); }
    loadRibbon();
    touchUpdate();
  }

  /* ---------- theme ---------- */
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    store.set('ms.theme', t);
    const btn = document.getElementById('theme');
    if (btn) btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    // repaint charts with new theme colors
    if (state.view && state.view.repaint) state.view.repaint();
    loadRibbon();
  }

  /* ---------- home view ---------- */
  const TOOLS = [
    ['stocks', 'stocks', 'Stock Tracker', 'Search any ticker, keep a watchlist, and read price history from 1 day to 5 years.'],
    ['crypto', 'crypto', 'Crypto Tracker', 'Top 50 coins with 1h / 24h / 7d moves, sparklines, 30-day charts and a fiat converter.'],
    ['gold', 'gold', 'Gold Price Tracker', 'Spot gold in your currency per ounce, gram, 10g, tola and kilo — for 24K, 22K, 21K and 18K.'],
    ['metals', 'metals', 'Silver & Metals', 'Silver, platinum and palladium unit tables plus the gold-to-silver ratio.'],
    ['indices', 'indices', 'World Market Indices', 'US, Europe, Asia-Pacific and MENA benchmarks with commodities and FX.'],
    ['currency', 'currency', 'Currency Converter', '12 currencies, live mid-market rates, inverse rate and a 1-month pair chart.'],
    ['calculators', 'calc', 'Calculators', 'Profit / loss, compound growth & SIP, and zakat on gold and silver.']
  ];

  views.home = {
    async render(el) {
      el.innerHTML = `
        <section class="hero">
          <div>
            <div class="tag">Finance &amp; Market Tools</div>
            <h1>Market data, seven focused tools, zero clutter.</h1>
            <p>Live stocks, crypto, gold and silver, world indices, currencies and calculators — all built directly on public market data feeds, in the currency you actually use.</p>
          </div>
          <div class="hero-stats" id="home-stats">
            ${['Gold (oz)', 'Silver (oz)', 'S&P 500'].map((k) => `<div class="hero-stat"><div class="k">${k}</div><div class="v"><span class="sk" style="width:90px;height:20px;display:block"></span></div></div>`).join('')}
          </div>
        </section>

        <div class="grid g4" style="margin-top:6px">
          ${TOOLS.map(([r, ic, t, d]) => `
            <a class="tool-card" href="#/${r}">
              <span class="ic">${icon(ic, 18)}</span>
              <h3>${t}</h3>
              <p>${d}</p>
              <span class="go">Open tool ${icon('arrow', 14)}</span>
            </a>`).join('')}
          <div class="tool-card" style="border-style:dashed;box-shadow:none">
            <span class="ic" style="background:transparent;border:1px solid var(--hair)">${icon('search', 18)}</span>
            <h3>Everything is keyless</h3>
            <p>No sign-up, no API keys, no tracking. Data is proxied and cached server-side so sources are never hammered.</p>
          </div>
        </div>`;
      this.refresh();
    },
    async refresh() {
      const box = document.getElementById('home-stats');
      if (!box) return;
      try {
        const [m, q] = await Promise.all([
          api('/api/metals').catch(() => null),
          api('/api/quote?symbols=^GSPC').catch(() => null)
        ]);
        const items = [];
        const g = m && m.metals && m.metals.gold;
        const s = m && m.metals && m.metals.silver;
        const sp = q && q.quotes && q.quotes[0];
        items.push(['Gold (per oz)', g ? usd(g.price, 0) : '—', g ? g.changePct : null]);
        items.push(['Silver (per oz)', s ? usd(s.price, 2) : '—', s ? s.changePct : null]);
        items.push(['S&P 500', sp ? nf(sp.price, 2, 2) : '—', sp ? sp.changePct : null]);
        box.innerHTML = items.map(([k, v, p]) => `<div class="hero-stat"><div class="k">${esc(k)}</div><div class="v num">${v} <span class="${cls(p)}" style="font-size:13px">${arrow(p)} ${pctText(p)}</span></div></div>`).join('');
      } catch (e) {
        box.innerHTML = `<div class="mono-note">Live headline quotes unavailable right now.</div>`;
      }
    }
  };

  /* ---------- boot ---------- */
  function bindGlobals() {
    document.getElementById('theme').addEventListener('click', () => {
      setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
    const cur = document.getElementById('cur');
    cur.value = state.currency;
    cur.addEventListener('change', () => {
      state.currency = cur.value;
      store.set('ms.cur', cur.value);
      route();
      loadRibbon();
    });
    document.getElementById('refresh').addEventListener('click', () => refreshCurrent());
    document.addEventListener('click', (e) => {
      const r = e.target.closest('[data-retry]');
      if (r) refreshCurrent();
    });
    window.addEventListener('hashchange', route);
    setInterval(paintUpdated, 5000);
    setInterval(() => { if (!document.hidden) refreshCurrent(); }, 60000);
  }

  async function boot() {
    setTheme(store.get('ms.theme') || 'light');
    bindGlobals();
    await loadFx();
    document.getElementById('cur').value = state.currency;
    await route();
    loadRibbon();
  }

  return {
    boot, api, views, state, store, route, refreshCurrent, loadFx, touchUpdate,
    conv, money, usd, nf, compact, pctText, pctChip, changeCell, cls, arrow, esc, autoDigits,
    skeletonTable, skeletonBlock, errorState, emptyState, failNote, icon,
    lineChart, sparkline, destroyChart, fmtDate, themeColors,
    CUR_SYM, TOLA_G, OZT_G, PURITY
  };
})();
