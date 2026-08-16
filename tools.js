/* ===== Market Silo — Gold, Silver & Metals, Currency Converter, Calculators ===== */
(function (MS) {
  const { api, esc, nf, usd, money, conv, pctText, pctChip, cls, arrow, changeCell,
    skeletonTable, skeletonBlock, errorState, failNote, icon, lineChart, TOLA_G, OZT_G, PURITY } = MS;

  const UNITS = [
    ['Per troy ounce (31.1035 g)', OZT_G],
    ['Per 10 grams', 10],
    ['Per gram', 1],
    ['Per tola (11.6638 g)', TOLA_G],
    ['Per kilogram', 1000]
  ];
  const KARATS = ['24K', '22K', '21K', '18K'];

  function unitPrice(usdPerOz, grams, purity) {
    if (usdPerOz === null || usdPerOz === undefined || !isFinite(usdPerOz)) return null;
    return (usdPerOz / OZT_G) * grams * purity;
  }

  function metalMatrix(usdPerOz, karats) {
    const ks = karats || KARATS;
    return `<div class="tbl-wrap"><table class="stack">
      <thead><tr><th scope="col">Unit</th>${ks.map((k) => `<th scope="col">${k}${k === '24K' ? ' (999)' : ''}</th>`).join('')}</tr></thead>
      <tbody>${UNITS.map(([label, grams]) => `<tr>
        <td><div class="sym">${esc(label)}</div></td>
        ${ks.map((k) => {
          const v = conv(unitPrice(usdPerOz, grams, PURITY[k] === undefined ? 1 : PURITY[k]));
          const d = v !== null && v > 1000 ? 0 : 2;
          return `<td data-l="${esc(k)}" class="num">${money(v, MS.state.currency, d)}</td>`;
        }).join('')}
      </tr>`).join('')}</tbody></table></div>`;
  }

  function metalHero(m, digits) {
    const cv = conv(m.price);
    const d = digits === undefined ? (cv !== null && Math.abs(cv) >= 10000 ? 0 : 2) : digits;
    return `<div class="bignum">
        <div><div class="k" style="font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-3);font-weight:700;margin-bottom:6px">${esc(m.name)} spot · per troy ounce</div>
        <div class="v num">${usd(m.price, d)}</div></div>
        <div style="padding-bottom:6px">${changeCell(conv(m.change), m.changePct, d)} <span class="${cls(m.changePct)}">(${pctText(m.changePct)})</span>
        <div class="mono-note">vs previous close ${usd(m.prevClose, d)}</div></div>
      </div>`;
  }

  const stamp = (m) => m && m.updatedAt ? new Date(m.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  /* ================= GOLD PRICE TRACKER ================= */
  MS.views.gold = {
    metals: null, karat: '24K', range: '1y', failed: [],
    async render(el) {
      el.innerHTML = `
        <div class="page-head">
          <div>
            <div class="eyebrow">Tool 03</div>
            <h1>Gold Price Tracker</h1>
            <p class="sub">Live gold spot converted into your currency across every unit that matters — troy ounce, 10 grams, gram, tola (11.6638 g) and kilogram — for 24K, 22K, 21K and 18K purity.</p>
          </div>
          <div class="toolbar">
            <div class="pill-row" id="gld-karats" role="group" aria-label="Highlight purity">
              ${KARATS.map((k) => `<button class="pill ${k === this.karat ? 'on' : ''}" data-k="${k}">${k}</button>`).join('')}
            </div>
          </div>
        </div>
        <div class="grid g2 split">
          <div class="card"><div class="card-body" id="gld-hero">${skeletonBlock(120)}</div>
            <div id="gld-stats"></div></div>
          <div class="card">
            <div class="card-head"><h3>Gold price history</h3>
              <div class="range-btns" id="gld-ranges">${[['1mo', '1M'], ['6mo', '6M'], ['1y', '1Y'], ['5y', '5Y']].map(([k, l]) => `<button data-r="${k}" class="${this.range === k ? 'on' : ''}">${l}</button>`).join('')}</div>
            </div>
            <div class="card-body"><div class="chart-box" id="gld-chart-host"><canvas id="gld-chart"></canvas></div></div>
          </div>
        </div>
        <div class="card" style="margin-top:16px">
          <div class="card-head"><h3 id="gld-matrix-title">Gold rate matrix</h3><span class="mono-note" id="gld-stamp"></span></div>
          <div id="gld-matrix">${skeletonTable(5, 5)}</div>
        </div>`;
      document.getElementById('gld-karats').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-k]'); if (!b) return;
        this.karat = b.dataset.k;
        document.querySelectorAll('#gld-karats .pill').forEach((p) => p.classList.toggle('on', p === b));
        this.paint();
      });
      document.getElementById('gld-ranges').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-r]'); if (!b) return;
        this.range = b.dataset.r;
        document.querySelectorAll('#gld-ranges button').forEach((x) => x.classList.toggle('on', x === b));
        this.loadChart();
      });
      await this.refresh();
    },
    async refresh() {
      try {
        const j = await api('/api/metals');
        this.metals = j.metals || {};
        this.failed = j.failed || [];
        if (!this.metals.gold) throw new Error('gold spot unavailable');
        this.paint();
        this.loadChart();
        MS.touchUpdate();
      } catch (e) {
        const h = document.getElementById('gld-hero');
        if (h) h.innerHTML = errorState(e.message, 'gold');
      }
    },
    paint() {
      const g = this.metals && this.metals.gold;
      if (!g) return;
      const pf = PURITY[this.karat];
      document.getElementById('gld-hero').innerHTML = metalHero(g);
      document.getElementById('gld-stats').innerHTML = `<div class="statgrid two" style="border-radius:0 0 10px 10px">
        <div class="cell"><div class="k">${this.karat} per gram</div><div class="stat-val">${money(conv(unitPrice(g.price, 1, pf)), MS.state.currency, 2)}</div></div>
        <div class="cell"><div class="k">${this.karat} per tola</div><div class="stat-val">${money(conv(unitPrice(g.price, TOLA_G, pf)), MS.state.currency, 0)}</div></div>
        <div class="cell"><div class="k">${this.karat} per 10 g</div><div class="stat-val">${money(conv(unitPrice(g.price, 10, pf)), MS.state.currency, 0)}</div></div>
        <div class="cell"><div class="k">Purity factor</div><div class="stat-val">${pf.toFixed(4)}</div></div>
      </div>`;
      document.getElementById('gld-matrix-title').textContent = `Gold rate matrix · ${MS.state.currency}`;
      document.getElementById('gld-stamp').textContent = 'Spot updated ' + stamp(g) + ' · source ' + (g.source || 'gold-api.com');
      document.getElementById('gld-matrix').innerHTML = metalMatrix(g.price) +
        `<div class="note">24K = spot × 1.0000 · 22K × 0.9167 · 21K × 0.8750 · 18K × 0.7500. Tola = 11.6638 g. Rates are international spot converted at live mid-market FX — local retail rates include dealer premiums, making charges and duties.</div>` +
        failNote(this.failed);
    },
    async loadChart() {
      const host = document.getElementById('gld-chart-host');
      if (!host) return;
      host.innerHTML = skeletonBlock(300);
      try {
        const j = await api(`/api/chart?symbol=GC%3DF&range=${this.range}`);
        host.innerHTML = '<canvas id="gld-chart"></canvas>';
        lineChart('gld-chart', j.points, { color: getComputedStyle(document.documentElement).getPropertyValue('--amber').trim() });
      } catch (e) {
        host.innerHTML = `<div class="mono-note" style="padding:20px 0">Gold futures history (GC=F) unavailable right now. <button class="btn sm" data-retry="gc">Retry</button></div>`;
      }
    },
    repaint() { this.paint(); this.loadChart(); }
  };

  /* ================= SILVER & METALS ================= */
  MS.views.metals = {
    metals: null, sel: 'silver', range: '1y', failed: [],
    async render(el) {
      el.innerHTML = `
        <div class="page-head">
          <div>
            <div class="eyebrow">Tool 04</div>
            <h1>Silver &amp; Metals Tracker</h1>
            <p class="sub">Silver, platinum and palladium spot prices with the same unit breakdown as gold, plus the gold-to-silver ratio — a classic relative-value gauge for precious metals.</p>
          </div>
          <div class="toolbar">
            <div class="pill-row" id="mt-sel" role="group" aria-label="Select metal">
              ${[['silver', 'Silver'], ['platinum', 'Platinum'], ['palladium', 'Palladium']].map(([k, l]) => `<button class="pill ${k === this.sel ? 'on' : ''}" data-m="${k}">${l}</button>`).join('')}
            </div>
          </div>
        </div>
        <div class="grid g4" id="mt-cards" style="margin-bottom:16px">${skeletonTable(1, 4)}</div>
        <div class="grid g2 split">
          <div class="card"><div class="card-body" id="mt-hero">${skeletonBlock(110)}</div><div id="mt-ratio"></div></div>
          <div class="card">
            <div class="card-head"><h3 id="mt-chart-title">History</h3>
              <div class="range-btns" id="mt-ranges">${[['1mo', '1M'], ['6mo', '6M'], ['1y', '1Y'], ['5y', '5Y']].map(([k, l]) => `<button data-r="${k}" class="${this.range === k ? 'on' : ''}">${l}</button>`).join('')}</div>
            </div>
            <div class="card-body"><div class="chart-box" id="mt-chart-host"><canvas id="mt-chart"></canvas></div></div>
          </div>
        </div>
        <div class="card" style="margin-top:16px">
          <div class="card-head"><h3 id="mt-matrix-title">Unit table</h3><span class="mono-note" id="mt-stamp"></span></div>
          <div id="mt-matrix">${skeletonTable(5, 3)}</div>
        </div>`;
      document.getElementById('mt-sel').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-m]'); if (!b) return;
        this.sel = b.dataset.m;
        document.querySelectorAll('#mt-sel .pill').forEach((p) => p.classList.toggle('on', p === b));
        this.paint(); this.loadChart();
      });
      document.getElementById('mt-ranges').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-r]'); if (!b) return;
        this.range = b.dataset.r;
        document.querySelectorAll('#mt-ranges button').forEach((x) => x.classList.toggle('on', x === b));
        this.loadChart();
      });
      await this.refresh();
    },
    async refresh() {
      try {
        const j = await api('/api/metals');
        this.metals = j.metals || {};
        this.failed = j.failed || [];
        if (!Object.keys(this.metals).length) throw new Error('metal prices unavailable');
        if (!this.metals[this.sel]) {
          const first = ['silver', 'platinum', 'palladium'].find((k) => this.metals[k]);
          if (first) this.sel = first;
        }
        this.paint(); this.loadChart();
        MS.touchUpdate();
      } catch (e) {
        const h = document.getElementById('mt-hero');
        if (h) h.innerHTML = errorState(e.message, 'metals');
      }
    },
    paint() {
      const ms = this.metals || {};
      const cards = ['gold', 'silver', 'platinum', 'palladium'].filter((k) => ms[k]);
      document.getElementById('mt-cards').innerHTML = cards.map((k) => {
        const m = ms[k];
        const d = m.price > 1000 ? 2 : 2;
        return `<div class="card"><div class="card-body">
          <div class="k" style="font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-3);font-weight:700">${esc(m.name)} / oz</div>
          <div class="num" style="font-size:22px;font-weight:800;margin:6px 0 4px">${usd(m.price, d)}</div>
          ${pctChip(m.changePct)}
        </div></div>`;
      }).join('') || '';

      const m = ms[this.sel];
      if (!m) { document.getElementById('mt-hero').innerHTML = errorState('This metal is unavailable from the spot feed.', 'metals'); return; }
      document.getElementById('mt-hero').innerHTML = metalHero(m);

      const g = ms.gold, s = ms.silver;
      const ratio = g && s && s.price ? g.price / s.price : null;
      document.getElementById('mt-ratio').innerHTML = `<div class="statgrid two" style="border-radius:0 0 10px 10px">
        <div class="cell"><div class="k">Gold / silver ratio</div><div class="stat-val">${ratio === null ? '—' : ratio.toFixed(2)}</div></div>
        <div class="cell"><div class="k">${esc(m.name)} per gram</div><div class="stat-val">${money(conv(unitPrice(m.price, 1, 1)), MS.state.currency, 2)}</div></div>
        <div class="cell"><div class="k">${esc(m.name)} per tola</div><div class="stat-val">${money(conv(unitPrice(m.price, TOLA_G, 1)), MS.state.currency, 2)}</div></div>
        <div class="cell"><div class="k">${esc(m.name)} per kg</div><div class="stat-val">${money(conv(unitPrice(m.price, 1000, 1)), MS.state.currency, 0)}</div></div>
      </div>`;

      document.getElementById('mt-matrix-title').textContent = `${m.name} unit table · ${MS.state.currency}`;
      document.getElementById('mt-stamp').textContent = 'Spot updated ' + stamp(m) + ' · source ' + (m.source || 'gold-api.com');
      const purities = this.sel === 'silver' ? ['999', '958', '925'] : ['999', '950'];
      const pf = { '999': 0.999, '958': 0.958, '925': 0.925, '950': 0.95 };
      document.getElementById('mt-matrix').innerHTML = `<div class="tbl-wrap"><table class="stack">
        <thead><tr><th scope="col">Unit</th><th scope="col">Pure (fine)</th>${purities.map((p) => `<th scope="col">${p} fineness</th>`).join('')}</tr></thead>
        <tbody>${UNITS.map(([label, grams]) => `<tr>
          <td><div class="sym">${esc(label)}</div></td>
          <td data-l="Pure" class="num">${money(conv(unitPrice(m.price, grams, 1)), MS.state.currency, grams >= 1000 ? 0 : 2)}</td>
          ${purities.map((p) => `<td data-l="${p} fineness" class="num">${money(conv(unitPrice(m.price, grams, pf[p])), MS.state.currency, grams >= 1000 ? 0 : 2)}</td>`).join('')}
        </tr>`).join('')}</tbody></table></div>
        <div class="note">Fineness factors: 999 = 0.999, 958 (Britannia silver) = 0.958, 925 (sterling) = 0.925, 950 (platinum standard) = 0.950. Tola = 11.6638 g.</div>${failNote(this.failed)}`;
      document.getElementById('mt-chart-title').textContent = m.name + ' history';
    },
    async loadChart() {
      const host = document.getElementById('mt-chart-host');
      if (!host) return;
      const sym = { silver: 'SI=F', platinum: 'PL=F', palladium: 'PA=F' }[this.sel] || 'SI=F';
      host.innerHTML = skeletonBlock(300);
      try {
        const j = await api(`/api/chart?symbol=${encodeURIComponent(sym)}&range=${this.range}`);
        host.innerHTML = '<canvas id="mt-chart"></canvas>';
        lineChart('mt-chart', j.points, { color: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() });
      } catch (e) {
        host.innerHTML = `<div class="mono-note" style="padding:20px 0">Futures history (${sym}) unavailable right now. <button class="btn sm" data-retry="mt">Retry</button></div>`;
      }
    },
    repaint() { this.paint(); this.loadChart(); }
  };

  /* ================= CURRENCY CONVERTER ================= */
  const FX_LIST = ['USD', 'PKR', 'SAR', 'AED', 'INR', 'EUR', 'GBP', 'JPY', 'CNY', 'TRY', 'CAD', 'AUD'];

  MS.views.currency = {
    from: 'USD', to: 'PKR', amount: 1,
    async render(el) {
      const opts = (sel) => FX_LIST.map((c) => `<option value="${c}" ${c === sel ? 'selected' : ''}>${c}</option>`).join('');
      el.innerHTML = `
        <div class="page-head">
          <div>
            <div class="eyebrow">Tool 06</div>
            <h1>Currency Converter</h1>
            <p class="sub">Live mid-market rates for twelve major currencies, derived from Yahoo Finance FX pairs and cached for five minutes. Mid-market means no retail spread is applied.</p>
          </div>
        </div>
        <div class="grid g2 split">
          <div class="card"><div class="card-body">
            <div class="field"><label for="fx-amt">Amount</label><input class="num" id="fx-amt" type="number" step="any" value="1" inputmode="decimal"></div>
            <div class="conv-box">
              <div class="field" style="margin:0"><label for="fx-from">From</label><select id="fx-from">${opts(this.from)}</select></div>
              <button class="btn icon" id="fx-swap" aria-label="Swap currencies" title="Swap currencies" style="margin-bottom:1px">${icon('swap', 16)}</button>
              <div class="field" style="margin:0"><label for="fx-to">To</label><select id="fx-to">${opts(this.to)}</select></div>
            </div>
            <div style="margin-top:20px" id="fx-out">${skeletonBlock(90)}</div>
          </div></div>
          <div class="card">
            <div class="card-head"><h3 id="fx-chart-title">Rate history · 1 month</h3><span class="mono-note">Yahoo FX pair</span></div>
            <div class="card-body"><div class="chart-box" id="fx-chart-host"><canvas id="fx-chart"></canvas></div></div>
          </div>
        </div>
        <div class="card" style="margin-top:16px">
          <div class="card-head"><h3 id="fx-tbl-title">Cross rates</h3><span class="mono-note">1 unit of base currency</span></div>
          <div id="fx-tbl">${skeletonTable(6, 3)}</div>
        </div>`;
      const amt = document.getElementById('fx-amt');
      const from = document.getElementById('fx-from'), to = document.getElementById('fx-to');
      amt.addEventListener('input', () => { this.amount = parseFloat(amt.value); this.paint(); });
      from.addEventListener('change', () => { this.from = from.value; this.paint(); this.loadChart(); });
      to.addEventListener('change', () => { this.to = to.value; this.paint(); this.loadChart(); });
      document.getElementById('fx-swap').addEventListener('click', () => {
        const f = this.from; this.from = this.to; this.to = f;
        from.value = this.from; to.value = this.to;
        this.paint(); this.loadChart();
      });
      await this.refresh();
    },
    async refresh() {
      await MS.loadFx();
      this.paint(); this.loadChart();
      MS.touchUpdate();
    },
    rateOf(a, b) {
      const ra = MS.state.fx[a], rb = MS.state.fx[b];
      if (!ra || !rb) return null;
      return rb / ra;
    },
    paint() {
      const out = document.getElementById('fx-out');
      if (!out) return;
      const r = this.rateOf(this.from, this.to);
      const amt = isFinite(this.amount) ? this.amount : null;
      if (r === null) {
        out.innerHTML = errorState(`Live rate for ${this.from} → ${this.to} is unavailable.`, 'fx');
      } else {
        const val = amt === null ? null : amt * r;
        out.innerHTML = `
          <div class="result-line big"><span class="k">${esc(nf(amt, 0, 4))} ${this.from} =</span><span class="v">${money(val, this.to, MS.autoDigits(val || 1))} ${this.to}</span></div>
          <div class="result-line"><span class="k">Rate</span><span class="v">1 ${this.from} = ${nf(r, 4, 6)} ${this.to}</span></div>
          <div class="result-line"><span class="k">Inverse rate</span><span class="v">1 ${this.to} = ${nf(1 / r, 4, 6)} ${this.from}</span></div>
          <div class="result-line"><span class="k">100 ${this.from}</span><span class="v">${nf(100 * r, 2, 2)} ${this.to}</span></div>
          <div class="result-line"><span class="k">1,000 ${this.from}</span><span class="v">${nf(1000 * r, 2, 2)} ${this.to}</span></div>`;
      }
      document.getElementById('fx-tbl-title').textContent = `Cross rates · base ${this.from}`;
      const rows = FX_LIST.filter((c) => c !== this.from).map((c) => [c, this.rateOf(this.from, c)]).filter((x) => x[1] !== null);
      document.getElementById('fx-tbl').innerHTML = rows.length ? `<div class="tbl-wrap"><table class="stack">
        <thead><tr><th scope="col">Currency</th><th scope="col">1 ${this.from} buys</th><th scope="col">Inverse</th></tr></thead>
        <tbody>${rows.map(([c, r2]) => `<tr><td><div class="sym">${c}</div></td>
          <td data-l="Rate" class="num">${nf(r2, 4, 6)}</td>
          <td data-l="Inverse" class="num">${nf(1 / r2, 4, 6)}</td></tr>`).join('')}</tbody></table></div>${failNote(MS.state.fxFailed)}`
        : errorState('No cross rates available.', 'fx');
    },
    async loadChart() {
      const host = document.getElementById('fx-chart-host');
      if (!host) return;
      const sym = `${this.from}${this.to}=X`;
      document.getElementById('fx-chart-title').textContent = `${this.from} / ${this.to} · 1 month`;
      host.innerHTML = skeletonBlock(300);
      try {
        const j = await api(`/api/chart?symbol=${encodeURIComponent(sym)}&range=1mo`);
        host.innerHTML = '<canvas id="fx-chart"></canvas>';
        const to = this.to;
        lineChart('fx-chart', j.points, {
          convert: false,
          color: getComputedStyle(document.documentElement).getPropertyValue('--amber').trim(),
          valueFmt: (v) => nf(v, 2, 4) + ' ' + to
        });
      } catch (e) {
        host.innerHTML = `<div class="mono-note" style="padding:20px 0">No 1-month history for ${esc(sym)}. Try the inverse pair. <button class="btn sm" data-retry="fxc">Retry</button></div>`;
      }
    },
    repaint() { this.paint(); this.loadChart(); }
  };

  /* ================= CALCULATORS ================= */
  const NISAB_GOLD_G = 87.48, NISAB_SILVER_G = 612.36;

  MS.views.calculators = {
    tab: 'pl', metals: null,
    async render(el, params) {
      if (params && params.t) this.tab = params.t;
      el.innerHTML = `
        <div class="page-head">
          <div>
            <div class="eyebrow">Tool 07</div>
            <h1>Calculators</h1>
            <p class="sub">Three practical market calculators. Everything runs in your browser; only the zakat tool touches the network, to read live gold and silver prices.</p>
          </div>
        </div>
        <div class="tabs" id="calc-tabs" role="tablist">
          <button data-t="pl" class="${this.tab === 'pl' ? 'on' : ''}" role="tab" aria-selected="${this.tab === 'pl'}">Profit / Loss</button>
          <button data-t="cg" class="${this.tab === 'cg' ? 'on' : ''}" role="tab" aria-selected="${this.tab === 'cg'}">Compound growth &amp; SIP</button>
          <button data-t="zakat" class="${this.tab === 'zakat' ? 'on' : ''}" role="tab" aria-selected="${this.tab === 'zakat'}">Zakat on gold &amp; silver</button>
        </div>
        <div id="calc-body"></div>`;
      document.getElementById('calc-tabs').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-t]'); if (!b) return;
        this.tab = b.dataset.t;
        document.querySelectorAll('#calc-tabs button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
        this.paint();
      });
      this.paint();
    },
    paint() {
      const host = document.getElementById('calc-body');
      if (!host) return;
      MS.destroyChart('cg-chart');
      if (this.tab === 'pl') this.paintPL(host);
      else if (this.tab === 'cg') this.paintCG(host);
      else this.paintZakat(host);
    },
    refresh() { if (this.tab === 'zakat') this.paint(); },
    repaint() { this.paint(); },

    /* ---- profit / loss ---- */
    paintPL(host) {
      const c = MS.state.currency;
      host.innerHTML = `<div class="grid g2 split">
        <div class="card"><div class="card-head"><h3>Trade inputs</h3></div><div class="card-body">
          <div class="row2">
            <div class="field"><label for="pl-buy">Buy price (${c})</label><input class="num" id="pl-buy" type="number" step="any" value="100"></div>
            <div class="field"><label for="pl-sell">Sell price (${c})</label><input class="num" id="pl-sell" type="number" step="any" value="118.5"></div>
          </div>
          <div class="row2">
            <div class="field"><label for="pl-qty">Quantity</label><input class="num" id="pl-qty" type="number" step="any" value="50"></div>
            <div class="field"><label for="pl-fee">Total fees / commission (${c})</label><input class="num" id="pl-fee" type="number" step="any" value="12"><span class="hint">Round-trip: buy + sell costs</span></div>
          </div>
        </div></div>
        <div class="card"><div class="card-head"><h3>Result</h3></div><div class="card-body" id="pl-out"></div></div>
      </div>`;
      const calc = () => {
        const buy = parseFloat(document.getElementById('pl-buy').value);
        const sell = parseFloat(document.getElementById('pl-sell').value);
        const qty = parseFloat(document.getElementById('pl-qty').value);
        const fee = parseFloat(document.getElementById('pl-fee').value) || 0;
        const out = document.getElementById('pl-out');
        if (![buy, sell, qty].every((n) => isFinite(n)) || buy <= 0 || qty <= 0) {
          out.innerHTML = `<p class="mono-note">Enter a positive buy price and quantity to see the result.</p>`;
          return;
        }
        const cost = buy * qty, proceeds = sell * qty;
        const gross = proceeds - cost, net = gross - fee;
        const pct = (net / cost) * 100;
        const be = (cost + fee) / qty;
        out.innerHTML = `
          <div class="result-line big"><span class="k">Net profit / loss</span><span class="v ${cls(net)}">${arrow(net)} ${money(net, c, 2)}</span></div>
          <div class="result-line"><span class="k">Return on cost</span><span class="v ${cls(pct)}">${pctText(pct)}</span></div>
          <div class="result-line"><span class="k">Gross P/L (before fees)</span><span class="v">${money(gross, c, 2)}</span></div>
          <div class="result-line"><span class="k">Total cost</span><span class="v">${money(cost, c, 2)}</span></div>
          <div class="result-line"><span class="k">Total proceeds</span><span class="v">${money(proceeds, c, 2)}</span></div>
          <div class="result-line"><span class="k">Break-even sell price</span><span class="v">${money(be, c, 4)}</span></div>
          <div class="result-line"><span class="k">Fees as % of cost</span><span class="v">${nf((fee / cost) * 100, 2, 2)}%</span></div>`;
      };
      ['pl-buy', 'pl-sell', 'pl-qty', 'pl-fee'].forEach((id) => document.getElementById(id).addEventListener('input', calc));
      calc();
    },

    /* ---- compound growth / SIP ---- */
    paintCG(host) {
      const c = MS.state.currency;
      host.innerHTML = `<div class="grid g2 split">
        <div class="card"><div class="card-head"><h3>Plan inputs</h3></div><div class="card-body">
          <div class="row2">
            <div class="field"><label for="cg-init">Initial amount (${c})</label><input class="num" id="cg-init" type="number" step="any" value="5000"></div>
            <div class="field"><label for="cg-mon">Monthly contribution (${c})</label><input class="num" id="cg-mon" type="number" step="any" value="500"></div>
          </div>
          <div class="row2">
            <div class="field"><label for="cg-rate">Annual return (%)</label><input class="num" id="cg-rate" type="number" step="any" value="10"></div>
            <div class="field"><label for="cg-yrs">Years</label><input class="num" id="cg-yrs" type="number" step="1" value="15"></div>
          </div>
          <div id="cg-out"></div>
        </div></div>
        <div class="card"><div class="card-head"><h3>Contributions vs growth</h3></div>
          <div class="card-body"><div class="chart-box"><canvas id="cg-chart"></canvas></div></div></div>
      </div>`;
      const calc = () => {
        const init = parseFloat(document.getElementById('cg-init').value) || 0;
        const mon = parseFloat(document.getElementById('cg-mon').value) || 0;
        const rate = parseFloat(document.getElementById('cg-rate').value);
        const yrs = parseInt(document.getElementById('cg-yrs').value, 10);
        const out = document.getElementById('cg-out');
        if (!isFinite(rate) || !isFinite(yrs) || yrs <= 0 || yrs > 60) {
          out.innerHTML = `<p class="mono-note">Enter an annual return and a term between 1 and 60 years.</p>`;
          MS.destroyChart('cg-chart');
          return;
        }
        const rm = Math.pow(1 + rate / 100, 1 / 12) - 1;
        const labels = [], contrib = [], growth = [];
        let bal = init, put = init;
        for (let y = 0; y <= yrs; y++) {
          if (y > 0) {
            for (let m = 0; m < 12; m++) { bal = bal * (1 + rm) + mon; put += mon; }
          }
          labels.push('Y' + y); contrib.push(put); growth.push(Math.max(bal - put, 0));
        }
        const final = bal, total = put, gain = final - total;
        out.innerHTML = `
          <div class="result-line big"><span class="k">Final value</span><span class="v">${money(final, c, 0)}</span></div>
          <div class="result-line"><span class="k">Total contributed</span><span class="v">${money(total, c, 0)}</span></div>
          <div class="result-line"><span class="k">Investment growth</span><span class="v ${cls(gain)}">${arrow(gain)} ${money(gain, c, 0)}</span></div>
          <div class="result-line"><span class="k">Growth multiple</span><span class="v">${total ? (final / total).toFixed(2) + '×' : '—'}</span></div>
          <div class="result-line"><span class="k">Effective monthly rate</span><span class="v">${(rm * 100).toFixed(3)}%</span></div>`;

        MS.destroyChart('cg-chart');
        const el = document.getElementById('cg-chart');
        if (!el || !window.Chart) return;
        const t = MS.themeColors();
        MS.state.charts['cg-chart'] = new Chart(el.getContext('2d'), {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: 'Contributed', data: contrib, backgroundColor: t.ink, borderRadius: 2, stack: 's' },
              { label: 'Growth', data: growth, backgroundColor: t.amber, borderRadius: 2, stack: 's' }
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { color: t.ink3, boxWidth: 10, boxHeight: 10, font: { size: 11 } } },
              tooltip: {
                backgroundColor: t.ink, titleColor: t.surface, bodyColor: t.surface, padding: 10, cornerRadius: 6,
                callbacks: { label: (it) => it.dataset.label + ': ' + money(it.raw, c, 0) }
              }
            },
            scales: {
              x: { stacked: true, grid: { display: false }, ticks: { color: t.ink3, font: { size: 10 }, maxTicksLimit: 12 } },
              y: { stacked: true, position: 'right', grid: { color: t.hair }, border: { display: false }, ticks: { color: t.ink3, font: { size: 10 }, callback: (v) => MS.compact(v, c) } }
            }
          }
        });
      };
      ['cg-init', 'cg-mon', 'cg-rate', 'cg-yrs'].forEach((id) => document.getElementById(id).addEventListener('input', calc));
      calc();
    },

    /* ---- zakat ---- */
    async paintZakat(host) {
      const c = MS.state.currency;
      host.innerHTML = `<div class="grid g2 split">
        <div class="card"><div class="card-head"><h3>Your assets</h3></div><div class="card-body">
          <div class="row2">
            <div class="field"><label for="z-gold">Gold held (grams)</label><input class="num" id="z-gold" type="number" step="any" value="100"></div>
            <div class="field"><label for="z-karat">Gold purity</label><select id="z-karat">${Object.keys(PURITY).map((k) => `<option value="${k}" ${k === '22K' ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
          </div>
          <div class="row2">
            <div class="field"><label for="z-silver">Silver held (grams)</label><input class="num" id="z-silver" type="number" step="any" value="0"></div>
            <div class="field"><label for="z-cash">Cash &amp; receivables (${c})</label><input class="num" id="z-cash" type="number" step="any" value="0"></div>
          </div>
          <div class="field"><label for="z-liab">Debts &amp; liabilities due (${c})</label><input class="num" id="z-liab" type="number" step="any" value="0"></div>
          <p class="hint">Nisab thresholds: ${NISAB_GOLD_G} g gold (7.5 tola) or ${NISAB_SILVER_G} g silver (52.5 tola). Zakat rate 2.5%. Most scholars use the lower (silver) threshold when you hold mixed assets.</p>
        </div></div>
        <div class="card"><div class="card-head"><h3>Zakat assessment</h3><span class="mono-note" id="z-src"></span></div><div class="card-body" id="z-out">${skeletonBlock(200)}</div></div>
      </div>`;
      let ms = this.metals;
      try {
        if (!ms) { const j = await api('/api/metals'); ms = this.metals = j.metals; }
      } catch (e) { ms = null; }
      const out = document.getElementById('z-out');
      if (!out) return;
      if (!ms || !ms.gold || !ms.silver) {
        out.innerHTML = errorState('Live gold and silver prices are required for the nisab check and are currently unavailable.', 'zakat');
        return;
      }
      document.getElementById('z-src').textContent = 'Spot ' + stamp(ms.gold);
      const goldG = conv(ms.gold.price / OZT_G), silverG = conv(ms.silver.price / OZT_G);
      const calc = () => {
        const gg = parseFloat(document.getElementById('z-gold').value) || 0;
        const kar = document.getElementById('z-karat').value;
        const sg = parseFloat(document.getElementById('z-silver').value) || 0;
        const cash = parseFloat(document.getElementById('z-cash').value) || 0;
        const liab = parseFloat(document.getElementById('z-liab').value) || 0;
        const goldVal = gg * goldG * PURITY[kar];
        const silverVal = sg * silverG;
        const net = goldVal + silverVal + cash - liab;
        const nisabGold = NISAB_GOLD_G * goldG;
        const nisabSilver = NISAB_SILVER_G * silverG;
        const nisab = Math.min(nisabGold, nisabSilver);
        const due = net >= nisab && net > 0 ? net * 0.025 : 0;
        const meets = net >= nisab && net > 0;
        out.innerHTML = `
          <div class="result-line big"><span class="k">Zakat due (2.5%)</span><span class="v" style="color:${meets ? 'var(--pos)' : 'var(--ink-3)'}">${meets ? money(due, c, 2) : money(0, c, 2)}</span></div>
          <div class="result-line"><span class="k">Nisab status</span><span class="v" style="color:${meets ? 'var(--pos)' : 'var(--neg)'}">${meets ? 'Above nisab — zakat payable' : 'Below nisab — none payable'}</span></div>
          <div class="result-line"><span class="k">Net zakatable wealth</span><span class="v">${money(net, c, 2)}</span></div>
          <div class="result-line"><span class="k">Gold value (${kar}, ${nf(gg, 0, 2)} g)</span><span class="v">${money(goldVal, c, 2)}</span></div>
          <div class="result-line"><span class="k">Silver value (${nf(sg, 0, 2)} g)</span><span class="v">${money(silverVal, c, 2)}</span></div>
          <div class="result-line"><span class="k">Nisab · silver basis (${NISAB_SILVER_G} g)</span><span class="v">${money(nisabSilver, c, 0)}</span></div>
          <div class="result-line"><span class="k">Nisab · gold basis (${NISAB_GOLD_G} g)</span><span class="v">${money(nisabGold, c, 0)}</span></div>
          <div class="result-line"><span class="k">Applied nisab (lower)</span><span class="v">${money(nisab, c, 0)}</span></div>
          <div class="result-line"><span class="k">Live gold / silver per gram</span><span class="v">${money(goldG, c, 2)} · ${money(silverG, c, 2)}</span></div>
          <p class="hint" style="margin-top:12px">Estimate only, based on international spot prices and mid-market FX. Confirm your obligation with a qualified scholar, and use your local retail rate if that is your school's practice.</p>`;
      };
      ['z-gold', 'z-silver', 'z-cash', 'z-liab'].forEach((id) => document.getElementById(id).addEventListener('input', calc));
      document.getElementById('z-karat').addEventListener('change', calc);
      calc();
    }
  };
})(window.MS);
