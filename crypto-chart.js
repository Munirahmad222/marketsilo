import { json } from '../utils.js';

export async function handleCryptoChart(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const days = url.searchParams.get('days') || '30';

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${encodeURIComponent(days)}`,
      { cf: { cacheTtl: 30, cacheEverything: true } }
    );
    if (!res.ok) throw new Error('coingecko request failed (' + res.status + ')');
    const data = await res.json();
    const points = (data.prices || []).map(([t, c]) => ({ t, c }));
    if (!points.length) throw new Error('no history for ' + id);
    return json({ points });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
