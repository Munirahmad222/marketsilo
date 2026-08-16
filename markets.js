/* ===== Market Silo — Stock Tracker, Crypto Tracker, World Indices ===== */
(function (MS) {
  const { api, esc, nf, usd, money, conv, compact, pctText, pctChip, cls, arrow, changeCell,
    skeletonTable, skeletonBlock, errorState, emptyState, failNote, icon, lineChart, sparkline } = MS;

  const DEFAULT_WL = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'TSLA', 'META'];
  const RANGES = [['1d', '1D'], ['1w', '1W'], ['1mo', '1M'], ['6mo', '6M'], ['1y', '1Y'], ['5y', '5Y']];

  function getWL() {
    const raw = MS.store.get('ms.wl');
    if (!raw) return DEFAULT_WL.slice();
    try { const a = JSON.parse(raw); return Array.isArray(a) && a.length ? a : DEFAULT_WL.slice(); } catch (e) { return DEFAULT_WL.slice(); }
  }
  function setWL(a) { MS.store.set('ms.wl', JSON.stringify(a)); }

  function curSym(code) { return MS.CUR_SYM[code] || (code ? code + ' ' : ''); }

  /* ================= STOCK TRACKER ================= */
  MS.views.stocks = {
    sort: { key: 'symbol', dir: 1 },
    data: [],
    failed: [],
    sel: null,
    range: '1mo',

    async render(el, params) {
      el.innerHTML = `
        <div class="page-head">
          <div>
            <div class="eyebrow">Tool 01</div>
            <h1>Stock Tracker</h1>
            <p class="sub">Search any listed symbol, build a watchlist that persists in your browser, and open price history from one day to five years. Prices are shown in each security's own listing currency.</p>
          </div>
          <div class="toolbar">
            <div class="search-wrap">
              <span class="sic">${icon('search', 16)}</span>
              <input class="ctl" id="stk-q" type="search" autocomplete="off" placeholder="Search symbol or company…" aria-label="Search for a stock symbol">
              <div id="stk-res"></div>
            </div>
            <button class="btn sm" id="stk-reset">Reset watchlist</button>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3 id="stk-count">Watchlist</h3><span class="mono-note">Click any row for the chart</span></div>
          <div id="stk-body">${skeletonTable(7, 6)}</div>
        </div>
        <div id="stk-detail" class="detail"></div>`;

      this.bindSearch();
      document.getElementById('stk-reset').addEventListener('click', () => { setWL(DEFAULT_WL.slice()); this.refresh(); });
      if (params && params.symbol) this.sel = params.symbol.toUpperCase();
      await this.refresh();
    },

    bindSearch() {
      const q = document.getElementById('stk-q');
      const res = document.getElementById('stk-res');
      let timer = null;
      const close = () => { res.innerHTML = ''; };
      q.addEventListener('input', () => {
        clearTimeout(timer);
        const v = q.value.trim();
        if (v.length < 1) return close();
        timer = setTimeout(async () => {
          try {
            const j = await api('/api/search?q=' + encodeURIComponent(v));
            if (!j.results.length) { res.innerHTML = `<div class="results"><button disabled style="cursor:default">No matches for “${esc(v)}”</button></div>`; return; }
            res.innerHTML = `<div class="results">${j.results.slice(0, 7).map((r) => `
              <button data-sym="${esc(r.symbol)}"><span><span class="sym">${esc(r.symbol)}</span> <span class="r-nm">${esc(r.name)}</span></span><span class="r-nm">${esc(r.exchange)}</span></button>`).join('')}</div>`;
          } catch (e) {
            res.innerHTML = `<div class="results"><button disabled style="cursor:default">Symbol search unavailable</button></div>`;
          }
        }, 260);
      });
      res.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-sym]');
        if (!b) return;
        const sym = b.dataset.sym;
        const wl = getWL();
        if (!wl.includes(sym)) { wl.push(sym); setWL(wl); }
        q.value = ''; close();
        this.sel = sym;
        this.refresh();
      });
      document.addEventListener('click', (e) => { if (!e.target.closest('.search-wrap')) close(); });
    },

    async refresh() {
      const body = document.getElementById('stk-body');
      if (!body) return;
      const wl = getWL();
      if (!wl.length) { body.innerHTML = emptyState('Your watchlist is empty', 'Search for a symbol above to start tracking it.'); return; }
      if (!this.data.length) body.innerHTML = skeletonTable(Math.min(wl.length, 8), 6);
      try {
        const j = await api('/api/quote?symbols=' + encodeURIComponent(wl.join(',')));
        this.data = j.quotes || [];
        this.failed = j.failed || [];
        if (!this.data.length) { body.innerHTML = errorState('None of your watchlist symbols returned data.', 'stocks'); return; }
        this.paintTable();
        if (this.sel && !this.data.some((d) => d.symbol === this.sel)) this.sel = null;
        if (!this.sel) this.sel = this.data[0].symbol;
        this.paintDetail();
        MS.touchUpdate();
      } catch (e) {
        body.innerHTML = errorState(e.message, 'stocks');
      }
    },

    paintTable() {
      const body = document.getElementById('stk-body');
      const s = this.sort;
      const rows = this.data.slice().sort((a, b) => {
        const va = a[s.key], vb = b[s.key];
        if (typeof va === 'string') return va.localeCompare(vb) * s.dir;
        return ((va === null ? -Infinity : va) - (vb === null ? -Infinity : vb)) * s.dir;
      });
      const th = (key, label, klass) => `<th class="sortable ${klass || ''}" data-k="${key}" scope="col">${label}${s.key === key ? `<span class="arrow">${s.dir > 0 ? '▲' : '▼'}</span>` : ''}</th>`;
      document.getElementById('stk-count').textContent = `Watchlist · ${rows.length} symbol${rows.length === 1 ? '' : 's'}`;
      body.innerHTML = `<div class="tbl-wrap"><table class="stack">
        <thead><tr>
          ${th('symbol', 'Symbol')}${th('price', 'Price')}${th('change', 'Change')}${th('changePct', '% Change')}
          <th scope="col" class="hide-sm">Day range</th>${th('volume', 'Volume', 'hide-sm')}<th scope="col"><span class="sr-only">Remove</span></th>
        </tr></thead>
        <tbody>${rows.map((r) => {
          const sym = curSym(r.currency);
          const d = MS.autoDigits(r.price || 0);
          return `<tr class="clickable ${this.sel === r.symbol ? 'sel' : ''}" data-sym="${esc(r.symbol)}">
            <td><div class="sym">${esc(r.symbol)}</div><div class="nm">${esc((r.name || '').slice(0, 42))}</div></td>
            <td data-l="Price" class="num">${sym}${nf(r.price, d, d)}</td>
            <td data-l="Change" class="num">${changeCell(r.change, r.changePct, d)}</td>
            <td data-l="% Change" class="num">${pctChip(r.changePct)}</td>
            <td data-l="Day range" class="num hide-sm">${r.dayLow !== null && r.dayHigh !== null ? `${nf(r.dayLow, 2, 2)} – ${nf(r.dayHigh, 2, 2)}` : '—'}</td>
            <td data-l="Volume" class="num hide-sm">${r.volume ? compact(r.volume, '') : '—'}</td>
            <td><button class="btn sm" data-del="${esc(r.symbol)}" aria-label="Remove ${esc(r.symbol)} from watchlist">${icon('trash', 13)}</button></td>
          </tr>`;
        }).join('')}</tbody></table></div>${failNote(this.failed)}`;

      body.querySelectorAll('th.sortable').forEach((h) => h.addEventListener('click', () => {
        const k = h.dataset.k;
        if (this.sort.key === k) this.sort.dir *= -1; else this.sort = { key: k, dir: k === 'symbol' ? 1 : -1 };
        this.paintTable();
      }));
      body.querySelectorAll('tr[data-sym]').forEach((tr) => tr.addEventListener('click', (e) => {
        if (e.target.closest('[data-del]')) return;
        this.sel = tr.dataset.sym;
        this.paintTable(); this.paintDetail();
      }));
      body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', (e) => {
        e.stopPropagation();
        const sym = b.dataset.del;
        setWL(getWL().filter((x) => x !== sym));
        this.data = this.data.filter((x) => x.symbol !== sym);
        if (this.sel === sym) this.sel = this.data[0] ? this.data[0].symbol : null;
        if (!this.data.length) { document.getElementById('stk-body').innerHTML = emptyState('Your watchlist is empty', 'Search for a symbol above, or reset to the default watchlist.'); document.getElementById('stk-detail').innerHTML = ''; return; }
        this.paintTable(); this.paintDetail();
      }));
    },

    paintDetail() {
      const host = document.getElementById('stk-detail');
      if (!host || !this.sel) return;
      const q = this.data.find((d) => d.symbol === this.sel);
      if (!q) { host.innerHTML = ''; return; }
      const sym = curSym(q.currency);
      const d = MS.autoDigits(q.price || 0);
      host.innerHTML = `<div class="card">
        <div class="card-head">
          <div>
            <h3>${esc(q.symbol)} · ${esc(q.name || '')}</h3>
            <div class="mono-note">${esc(q.exchange || '')} · quoted in ${esc(q.currency || 'n/a')}</div>
          </div>
          <div class="range-btns" id="stk-ranges">${RANGES.map(([k, l]) => `<button data-r="${k}" class="${this.range === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        </div>
        <div class="card-body">
          <div class="bignum" style="margin-bottom:16px">
            <div class="v num">${sym}${nf(q.price, d, d)}</div>
            <div>${changeCell(q.change, q.changePct, d)} <span class="${cls(q.changePct)}">(${pctText(q.changePct)})</span></div>
          </div>
          <div class="statgrid" style="margin-bottom:18px">
            <div class="cell"><div class="k">Prev close</div><div class="stat-val">${nf(q.prevClose, 2, 2)}</div></div>
            <div class="cell"><div class="k">Day low</div><div class="stat-val">${nf(q.dayLow, 2, 2)}</div></div>
            <div class="cell"><div class="k">Day high</div><div class="stat-val">${nf(q.dayHigh, 2, 2)}</div></div>
            <div class="cell"><div class="k">52-wk low</div><div class="stat-val">${nf(q.fiftyTwoWeekLow, 2, 2)}</div></div>
            <div class="cell"><div class="k">52-wk high</div><div class="stat-val">${nf(q.fiftyTwoWeekHigh, 2, 2)}</div></div>
            <div class="cell"><div class="k">Volume</div><div class="stat-val">${q.volume ? compact(q.volume, '') : '—'}</div></div>
          </div>
          <div id="stk-chart-host"><div class="chart-box"><canvas id="stk-chart"></canvas></div></div>
        </div>
      </div>`;
      host.querySelectorAll('#stk-ranges button').forEach((b) => b.addEventListener('click', () => {
        this.range = b.dataset.r;
        host.querySelectorAll('#stk-ranges button').forEach((x) => x.classList.toggle('on', x === b));
        this.loadChart();
      }));
      this.loadChart();
    },

    async loadChart() {
      const host = document.getElementById('stk-chart-host');
      if (!host) return;
      const symbol = this.sel, range = this.range;
      host.innerHTML = `<div class="chart-box">${skeletonBlock(300)}</div>`;
      try {
        const j = await api(`/api/chart?symbol=${encodeURIComponent(symbol)}&range=${range}`);
        host.innerHTML = `<div class="chart-box"><canvas id="stk-chart"></canvas></div>`;
        const cs = curSym(j.currency);
        lineChart('stk-chart', j.points, {
          convert: false, intraday: range === '1d' || range === '1w',
          color: (j.points[j.points.length - 1].c >= j.points[0].c) ? getComputedStyle(document.documentElement).getPropertyValue('--pos').trim() : getComputedStyle(document.documentElement).getPropertyValue('--neg').trim(),
          valueFmt: (v) => cs + nf(v, 2, 2)
        });
      } catch (e) {
        host.innerHTML = errorState('No price history returned for ' + symbol + ' at this range.', 'chart');
      }
    },
    repaint() { if (this.sel) this.paintDetail(); }
  };

  /* ================= CRYPTO TRACKER ================= */
  MS.views.crypto = {
    coins: [], filter: '', sel: null, days: 30,
    async render(el) {
      el.innerHTML = `
        <div class="page-head">
          <div>
            <div class="eyebrow">Tool 02</div>
            <h1>Crypto Tracker</h1>
            <p class="sub">The 50 largest cryptoassets by market capitalisation, with 1-hour, 24-hour and 7-day moves, 7-day sparklines and 30-day history. Values convert into your selected display currency.</p>
          </div>
          <div class="toolbar">
            <div class="search-wrap">
              <span class="sic">${icon('search', 16)}</span>
              <input class="ctl" id="cr-q" type="search" autocomplete="off" placeholder="Filter coins…" aria-label="Filter coins">
            </div>
          </div>
        </div>
        <div class="grid g2 split" id="cr-grid" style="margin-bottom:16px">
          <div class="card" id="cr-conv-card">
            <div class="card-head"><h3>Crypto → fiat converter</h3></div>
            <div class="card-body" id="cr-conv">${skeletonBlock(150)}</div>
          </div>
          <div class="card" id="cr-detail-card">
            <div class="card-head"><h3 id="cr-detail-title">30-day chart</h3><span class="mono-note">Click a row to change coin</span></div>
            <div class="card-body"><div class="chart-box sm" id="cr-chart-host"><canvas id="cr-chart"></canvas></div></div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Top 50 by market cap</h3><span class="mono-note" id="cr-asof"></span></div>
          <div id="cr-body">${skeletonTable(8, 6)}</div>
        </div>`;
      document.getElementById('cr-q').addEventListener('input', (e) => { this.filter = e.target.value.trim().toLowerCase(); this.paint(); });
      await this.refresh();
    },
    async refresh() {
      const body = document.getElementById('cr-body');
      if (!body) return;
      if (!this.coins.length) body.innerHTML = skeletonTable(8, 6);
      try {
        const j = await api('/api/crypto');
        this.coins = j.coins || [];
        if (!this.coins.length) throw new Error('empty coin list');
        document.getElementById('cr-asof').textContent = 'CoinGecko · ' + new Date(j.asOf).toLocaleTimeString('en-US');
        if (!this.sel) this.sel = this.coins[0].id;
        this.paint(); this.paintConverter(); this.loadChart();
        MS.touchUpdate();
      } catch (e) {
        body.innerHTML = errorState(e.message, 'crypto');
      }
    },
    paint() {
      const body = document.getElementById('cr-body');
      const rows = this.coins.filter((c) => !this.filter || c.name.toLowerCase().includes(this.filter) || c.symbol.toLowerCase().includes(this.filter));
      if (!rows.length) { body.innerHTML = emptyState('No coins match that filter', `Nothing in the top 50 matches “${this.filter}”. Try a different name or ticker.`); return; }
      body.innerHTML = `<div class="tbl-wrap"><table class="stack">
        <thead><tr>
          <th scope="col">#&nbsp;&nbsp;Coin</th><th scope="col">Price</th><th scope="col" class="hide-sm">1h</th><th scope="col">24h</th>
          <th scope="col" class="hide-sm">7d</th><th scope="col" class="hide-sm">7d trend</th><th scope="col">Market cap</th><th scope="col" class="hide-sm">Volume 24h</th>
        </tr></thead>
        <tbody>${rows.map((c) => `
          <tr class="clickable ${this.sel === c.id ? 'sel' : ''}" data-id="${esc(c.id)}">
            <td><div class="sym">${c.rank || '—'}&nbsp;&nbsp;${esc(c.symbol)}</div><div class="nm">${esc(c.name)}</div></td>
            <td data-l="Price" class="num">${usd(c.price)}</td>
            <td data-l="1h" class="num hide-sm"><span class="${cls(c.ch1h)}">${arrow(c.ch1h)} ${pctText(c.ch1h)}</span></td>
            <td data-l="24h" class="num">${pctChip(c.ch24h)}</td>
            <td data-l="7d" class="num hide-sm"><span class="${cls(c.ch7d)}">${arrow(c.ch7d)} ${pctText(c.ch7d)}</span></td>
            <td class="hide-sm"><canvas class="spark" width="84" height="26" data-spark="${esc(c.id)}"></canvas></td>
            <td data-l="Market cap" class="num">${compact(conv(c.marketCap))}</td>
            <td data-l="Volume 24h" class="num hide-sm">${compact(conv(c.volume))}</td>
          </tr>`).join('')}</tbody></table></div>`;
      rows.forEach((c) => {
        const cv = body.querySelector(`canvas[data-spark="${c.id}"]`);
        if (cv && c.spark && c.spark.length > 2) sparkline(cv, c.spark, c.ch7d >= 0);
      });
      body.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => {
        this.sel = tr.dataset.id;
        this.paint(); this.loadChart();
      }));
    },
    paintConverter() {
      const host = document.getElementById('cr-conv');
      if (!host) return;
      const opts = this.coins.map((c) => `<option value="${esc(c.id)}">${esc(c.symbol)} · ${esc(c.name)}</option>`).join('');
      host.innerHTML = `
        <div class="field"><label for="cc-amt">Amount</label><input class="num" id="cc-amt" type="number" step="any" value="1" inputmode="decimal"></div>
        <div class="field"><label for="cc-coin">Coin</label><select id="cc-coin">${opts}</select></div>
        <div class="result-line big"><span class="k">Value</span><span class="v" id="cc-out">—</span></div>
        <div class="result-line"><span class="k">Unit price</span><span class="v" id="cc-unit">—</span></div>`;
      const calc = () => {
        const id = document.getElementById('cc-coin').value;
        const amt = parseFloat(document.getElementById('cc-amt').value);
        const c = this.coins.find((x) => x.id === id);
        const out = document.getElementById('cc-out'), unit = document.getElementById('cc-unit');
        if (!c || !isFinite(amt)) { out.textContent = '—'; unit.textContent = c ? usd(c.price) : '—'; return; }
        out.textContent = usd(c.price * amt, 2);
        unit.textContent = usd(c.price) + ' per ' + c.symbol;
      };
      document.getElementById('cc-amt').addEventListener('input', calc);
      document.getElementById('cc-coin').addEventListener('change', calc);
      if (this.sel) document.getElementById('cc-coin').value = this.sel;
      calc();
    },
    async loadChart() {
      const host = document.getElementById('cr-chart-host');
      if (!host || !this.sel) return;
      const c = this.coins.find((x) => x.id === this.sel);
      document.getElementById('cr-detail-title').textContent = (c ? c.name : 'Coin') + ' · 30-day chart';
      host.innerHTML = skeletonBlock(200);
      try {
        const j = await api(`/api/crypto/chart?id=${encodeURIComponent(this.sel)}&days=30`);
        host.innerHTML = '<canvas id="cr-chart"></canvas>';
        lineChart('cr-chart', j.points, { color: getComputedStyle(document.documentElement).getPropertyValue('--amber').trim() });
      } catch (e) {
        host.innerHTML = `<div class="mono-note" style="padding:16px 0">30-day history unavailable for this coin right now. <button class="btn sm" data-retry="cc">Retry</button></div>`;
      }
    },
    repaint() { this.paint(); this.loadChart(); }
  };

  /* ================= WORLD MARKET INDICES ================= */
  MS.views.indices = {
    groups: [], failed: [], extra: null,
    async render(el) {
      el.innerHTML = `
        <div class="page-head">
          <div>
            <div class="eyebrow">Tool 05</div>
            <h1>World Market Indices</h1>
            <p class="sub">Benchmark equity indices across the United States, Europe, Asia-Pacific and MENA / South Asia, plus a commodities and currency strip. Index levels are shown in points, not converted.</p>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Global benchmarks</h3><span class="mono-note">Yahoo Finance chart API</span></div>
          <div id="idx-body">${skeletonTable(10, 5)}</div>
        </div>
        <div class="grid g2" style="margin-top:16px">
          <div class="card"><div class="card-head"><h3>Commodities</h3></div><div id="idx-comm">${skeletonTable(4, 3)}</div></div>
          <div class="card"><div class="card-head"><h3>Currencies (vs USD)</h3></div><div id="idx-fx">${skeletonTable(4, 3)}</div></div>
        </div>`;
      await this.refresh();
    },
    async refresh() {
      const body = document.getElementById('idx-body');
      if (!body) return;
      try {
        const j = await api('/api/indices');
        this.groups = j.groups || [];
        this.failed = j.failed || [];
        const any = this.groups.some((g) => g && g.rows.length);
        if (!any) throw new Error('no index data returned');
        body.innerHTML = `<div class="tbl-wrap"><table class="stack">
          <thead><tr><th scope="col">Index</th><th scope="col">Level</th><th scope="col">Change</th><th scope="col">% Change</th><th scope="col" class="hide-sm">Day range</th><th scope="col" class="hide-sm">Trend</th></tr></thead>
          <tbody>${this.groups.filter(Boolean).map((g) => {
            if (!g.rows.length) return `<tr class="region-row"><td colspan="6">${esc(g.region)} — data unavailable</td></tr>`;
            return `<tr class="region-row"><td colspan="6">${esc(g.region)}</td></tr>` + g.rows.map((r) => `
              <tr>
                <td><div class="sym">${esc(r.label)}</div><div class="nm">${esc(r.symbol)}</div></td>
                <td data-l="Level" class="num">${nf(r.price, 2, 2)}</td>
                <td data-l="Change" class="num">${changeCell(r.change, r.changePct, 2)}</td>
                <td data-l="% Change" class="num">${pctChip(r.changePct)}</td>
                <td data-l="Day range" class="num hide-sm">${r.dayLow && r.dayHigh ? nf(r.dayLow, 0, 0) + ' – ' + nf(r.dayHigh, 0, 0) : '—'}</td>
                <td class="hide-sm"><canvas class="spark" width="84" height="26" data-spark="${esc(r.symbol)}"></canvas></td>
              </tr>`).join('');
          }).join('')}</tbody></table></div>${failNote(this.failed)}`;
        this.groups.filter(Boolean).forEach((g) => g.rows.forEach((r) => {
          const cv = body.querySelector(`canvas[data-spark="${CSS.escape(r.symbol)}"]`);
          if (cv && r.spark && r.spark.length > 2) sparkline(cv, r.spark, (r.changePct || 0) >= 0);
        }));
        MS.touchUpdate();
      } catch (e) {
        body.innerHTML = errorState(e.message, 'indices');
      }
      this.loadStrip('idx-comm', [['GC=F', 'Gold futures'], ['SI=F', 'Silver futures'], ['CL=F', 'Crude oil WTI'], ['NG=F', 'Natural gas'], ['HG=F', 'Copper']]);
      this.loadStrip('idx-fx', [['USDPKR=X', 'USD / PKR'], ['USDINR=X', 'USD / INR'], ['USDSAR=X', 'USD / SAR'], ['EURUSD=X', 'EUR / USD'], ['GBPUSD=X', 'GBP / USD'], ['USDJPY=X', 'USD / JPY']]);
    },
    async loadStrip(hostId, items) {
      const host = document.getElementById(hostId);
      if (!host) return;
      try {
        const j = await api('/api/quote?symbols=' + encodeURIComponent(items.map((i) => i[0]).join(',')));
        const byS = {}; (j.quotes || []).forEach((q) => { byS[q.symbol] = q; });
        const rows = items.filter((i) => byS[i[0]]);
        if (!rows.length) throw new Error('no data');
        host.innerHTML = `<div class="tbl-wrap"><table class="stack"><thead><tr><th scope="col">Instrument</th><th scope="col">Last</th><th scope="col">Change</th><th scope="col">%</th></tr></thead>
          <tbody>${rows.map(([s, label]) => {
            const q = byS[s];
            const d = MS.autoDigits(q.price || 0);
            return `<tr><td><div class="sym">${esc(label)}</div><div class="nm">${esc(s)}</div></td>
              <td data-l="Last" class="num">${nf(q.price, d, d)}</td>
              <td data-l="Change" class="num">${changeCell(q.change, q.changePct, d)}</td>
              <td data-l="%" class="num">${pctChip(q.changePct)}</td></tr>`;
          }).join('')}</tbody></table></div>${failNote((j.failed || []).map((f) => ({ symbol: f.symbol })))}`;
      } catch (e) {
        host.innerHTML = errorState('This strip could not be loaded.', hostId);
      }
    },
    repaint() { this.refresh(); }
  };
})(window.MS);
