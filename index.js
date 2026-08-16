import { CORS } from './utils.js';
import { handleQuote } from './api/quote.js';
import { handleChart } from './api/chart.js';
import { handleSearch } from './api/search.js';
import { handleCrypto } from './api/crypto.js';
import { handleCryptoChart } from './api/crypto-chart.js';
import { handleIndices } from './api/indices.js';
import { handleMetals } from './api/metals.js';
import { handleFx } from './api/fx.js';
import { handleRibbon } from './api/ribbon.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    try {
      if (url.pathname === '/api/quote') return await handleQuote(request);
      if (url.pathname === '/api/chart') return await handleChart(request);
      if (url.pathname === '/api/search') return await handleSearch(request);
      if (url.pathname === '/api/crypto') return await handleCrypto();
      if (url.pathname === '/api/crypto/chart') return await handleCryptoChart(request);
      if (url.pathname === '/api/indices') return await handleIndices();
      if (url.pathname === '/api/metals') return await handleMetals();
      if (url.pathname === '/api/fx') return await handleFx();
      if (url.pathname === '/api/ribbon') return await handleRibbon();
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e.message || e) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }

    // Anything that isn't an /api/* route falls through to the static site
    // (index.html, core.js, markets.js, tools.js, styles.css, etc.)
    return env.ASSETS.fetch(request);
  }
};
