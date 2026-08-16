export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...CORS }
  });
}

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'application/json'
};

// Fetches Yahoo Finance's chart endpoint, which doubles as both a
// current-quote source (via .meta) and a history source (via timestamp/close arrays).
export async function yfChart(symbol, range, interval) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const res = await fetch(url, { headers: YF_HEADERS, cf: { cacheTtl: 20, cacheEverything: true } });
  if (!res.ok) throw new Error('yahoo request failed (' + res.status + ')');
  const data = await res.json();
  const result = data && data.chart && data.chart.result && data.chart.result[0];
  if (!result || !result.meta) throw new Error('no data for ' + symbol);
  return result;
}

export function quoteFromResult(symbol, result) {
  const m = result.meta || {};
  const price = m.regularMarketPrice ?? null;
  const prevClose = m.chartPreviousClose ?? m.previousClose ?? null;
  const change = (price != null && prevClose != null) ? price - prevClose : null;
  const changePct = (change != null && prevClose) ? (change / prevClose) * 100 : null;
  return {
    symbol: m.symbol || symbol,
    name: m.longName || m.shortName || m.symbol || symbol,
    exchange: m.fullExchangeName || m.exchangeName || '',
    currency: m.currency || 'USD',
    price,
    change,
    changePct,
    prevClose,
    dayLow: m.regularMarketDayLow ?? null,
    dayHigh: m.regularMarketDayHigh ?? null,
    fiftyTwoWeekLow: m.fiftyTwoWeekLow ?? null,
    fiftyTwoWeekHigh: m.fiftyTwoWeekHigh ?? null,
    volume: m.regularMarketVolume ?? null
  };
}
