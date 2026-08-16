import { json, yfChart, quoteFromResult } from '../utils.js';

export async function handleQuote(request) {
  const url = new URL(request.url);
  const symbols = (url.searchParams.get('symbols') || '')
    .split(',').map((s) => s.trim()).filter(Boolean);

  const quotes = [];
  const failed = [];
  await Promise.all(symbols.map(async (sym) => {
    try {
      const result = await yfChart(sym, '5d', '1d');
      quotes.push(quoteFromResult(sym, result));
    } catch (e) {
      failed.push({ symbol: sym, error: String(e.message || e) });
    }
  }));

  return json({ quotes, failed });
}
