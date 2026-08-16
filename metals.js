import { json, yfChart } from '../utils.js';

// gold-api.com gives current spot only (no prior-close), so we pair it with
// the matching Yahoo futures contract to derive change/changePct/prevClose.
const METALS = [
  ['gold', 'XAU', 'GC=F'],
  ['silver', 'XAG', 'SI=F'],
  ['platinum', 'XPT', 'PL=F'],
  ['palladium', 'XPD', 'PA=F']
];

export async function handleMetals() {
  const metals = {};
  const failed = [];

  await Promise.all(METALS.map(async ([key, sym, futuresSym]) => {
    try {
      const res = await fetch(`https://api.gold-api.com/price/${sym}`, { cf: { cacheTtl: 20, cacheEverything: true } });
      if (!res.ok) throw new Error('gold-api request failed (' + res.status + ')');
      const d = await res.json();
      const price = d.price ?? null;
      if (price == null) throw new Error('no spot price for ' + sym);

      let prevClose = null, change = null, changePct = null;
      try {
        const fut = await yfChart(futuresSym, '5d', '1d');
        prevClose = fut.meta.chartPreviousClose ?? fut.meta.previousClose ?? null;
        if (prevClose != null) {
          change = price - prevClose;
          changePct = (change / prevClose) * 100;
        }
      } catch (e) { /* change data optional */ }

      metals[key] = {
        name: key.charAt(0).toUpperCase() + key.slice(1),
        price, change, changePct, prevClose,
        updatedAt: d.updatedAt || d.updated_at || Date.now(),
        source: 'gold-api.com'
      };
    } catch (e) {
      failed.push({ symbol: sym, error: String(e.message || e) });
    }
  }));

  return json({ metals, failed });
}
