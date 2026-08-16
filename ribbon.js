import { json, yfChart, quoteFromResult } from '../utils.js';

const ITEMS = [
  ['^GSPC', 'S&P 500', 'index'],
  ['^DJI', 'Dow Jones', 'index'],
  ['^IXIC', 'Nasdaq', 'index'],
  ['GC=F', 'Gold', 'price'],
  ['SI=F', 'Silver', 'price'],
  ['CL=F', 'Crude Oil', 'price'],
  ['EURUSD=X', 'EUR/USD', 'rate'],
  ['GBPUSD=X', 'GBP/USD', 'rate'],
  ['USDPKR=X', 'USD/PKR', 'rate']
];

export async function handleRibbon() {
  const items = [];
  await Promise.all(ITEMS.map(async ([sym, label, kind]) => {
    try {
      const result = await yfChart(sym, '5d', '1d');
      const q = quoteFromResult(sym, result);
      items.push({ label, kind, price: q.price, changePct: q.changePct });
    } catch (e) { /* skip this ticker if unavailable */ }
  }));
  return json({ items });
}
