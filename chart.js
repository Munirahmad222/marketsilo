import { json, yfChart } from '../utils.js';

const RANGE_MAP = {
  '1d': ['1d', '5m'],
  '1w': ['5d', '15m'],
  '1mo': ['1mo', '1d'],
  '6mo': ['6mo', '1d'],
  '1y': ['1y', '1wk'],
  '5y': ['5y', '1wk']
};

export async function handleChart(request) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get('symbol');
  const range = url.searchParams.get('range') || '1mo';
  const [yRange, yInterval] = RANGE_MAP[range] || RANGE_MAP['1mo'];

  try {
    const result = await yfChart(symbol, yRange, yInterval);
    const ts = result.timestamp || [];
    const closes = (result.indicators && result.indicators.quote && result.indicators.quote[0] && result.indicators.quote[0].close) || [];
    const points = [];
    for (let i = 0; i < ts.length; i++) {
      if (closes[i] != null) points.push({ t: ts[i] * 1000, c: closes[i] });
    }
    if (!points.length) return json({ error: 'no price history for ' + symbol }, 404);
    return json({ currency: (result.meta && result.meta.currency) || 'USD', points });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
