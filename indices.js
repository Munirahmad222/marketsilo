import { json, yfChart, quoteFromResult } from '../utils.js';

const GROUPS = [
  ['United States', [['^GSPC', 'S&P 500'], ['^DJI', 'Dow Jones'], ['^IXIC', 'Nasdaq'], ['^RUT', 'Russell 2000']]],
  ['Europe', [['^FTSE', 'FTSE 100'], ['^GDAXI', 'DAX'], ['^FCHI', 'CAC 40'], ['^STOXX50E', 'Euro Stoxx 50']]],
  ['Asia-Pacific', [['^N225', 'Nikkei 225'], ['^HSI', 'Hang Seng'], ['^AXJO', 'ASX 200'], ['000001.SS', 'Shanghai Composite']]],
  ['MENA / South Asia', [['^KSE', 'KSE 100'], ['^NSEI', 'Nifty 50'], ['^BSESN', 'Sensex'], ['^TASI.SR', 'Tadawul All Share']]]
];

export async function handleIndices() {
  const failed = [];
  const groups = await Promise.all(GROUPS.map(async ([region, list]) => {
    const rows = [];
    await Promise.all(list.map(async ([sym, label]) => {
      try {
        const result = await yfChart(sym, '5d', '1d');
        const q = quoteFromResult(sym, result);
        rows.push({
          label, symbol: sym, price: q.price, change: q.change,
          changePct: q.changePct, dayLow: q.dayLow, dayHigh: q.dayHigh, spark: []
        });
      } catch (e) {
        failed.push({ symbol: sym, error: String(e.message || e) });
      }
    }));
    return { region, rows };
  }));
  return json({ groups, failed });
}
