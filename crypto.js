import { json } from '../utils.js';

export async function handleCrypto() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=1h,24h,7d',
      { cf: { cacheTtl: 30, cacheEverything: true } }
    );
    if (!res.ok) throw new Error('coingecko request failed (' + res.status + ')');
    const data = await res.json();
    const coins = data.map((c) => ({
      id: c.id,
      symbol: (c.symbol || '').toUpperCase(),
      name: c.name,
      price: c.current_price,
      ch1h: c.price_change_percentage_1h_in_currency ?? null,
      ch24h: c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? null,
      ch7d: c.price_change_percentage_7d_in_currency ?? null,
      marketCap: c.market_cap,
      volume: c.total_volume,
      spark: (c.sparkline_in_7d && c.sparkline_in_7d.price) || []
    }));
    return json({ coins, asOf: Date.now() });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
