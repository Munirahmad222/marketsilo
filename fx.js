import { json, yfChart } from '../utils.js';

// Direct pairs are quoted as USDxxx=X (1 USD = price units of xxx).
const DIRECT = ['PKR', 'SAR', 'AED', 'INR', 'JPY', 'CNY', 'TRY', 'CAD', 'AUD'];
// Inverted pairs are quoted as xxxUSD=X (price USD = 1 unit of xxx),
// so 1 USD = 1/price units of xxx.
const INVERTED = ['EUR', 'GBP'];

export async function handleFx() {
  const rates = { USD: 1 };
  const failed = [];

  await Promise.all([
    ...DIRECT.map(async (cur) => {
      try {
        const result = await yfChart(`USD${cur}=X`, '5d', '1d');
        const p = result.meta && result.meta.regularMarketPrice;
        if (p == null) throw new Error('no rate');
        rates[cur] = p;
      } catch (e) {
        failed.push({ symbol: cur, error: String(e.message || e) });
      }
    }),
    ...INVERTED.map(async (cur) => {
      try {
        const result = await yfChart(`${cur}USD=X`, '5d', '1d');
        const p = result.meta && result.meta.regularMarketPrice;
        if (!p) throw new Error('no rate');
        rates[cur] = 1 / p;
      } catch (e) {
        failed.push({ symbol: cur, error: String(e.message || e) });
      }
    })
  ]);

  return json({ rates, failed });
}
