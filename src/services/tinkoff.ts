export interface TinkoffDividend {
  ticker: string;
  paymentDate: string;
  recordDate: string;
  dividendNet: number;
  yieldValue: number;
  currency: string;
}

export async function fetchTinkoffDividends(token: string, tickers: string[]): Promise<TinkoffDividend[]> {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const now = new Date();
  const from = now.toISOString();
  // +1 year
  const nextYear = new Date(now);
  nextYear.setFullYear(now.getFullYear() + 1);
  const to = nextYear.toISOString();

  const results: TinkoffDividend[] = [];

  await Promise.all(tickers.map(async (ticker) => {
    try {
      // 1. Get Instrument ID (we try TQBR for shares)
      let instrumentRes = await fetch('https://invest-public-api.tinkoff.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/ShareBy', {
        method: 'POST',
        headers,
        body: JSON.stringify({ idType: 'INSTRUMENT_ID_TYPE_TICKER', classCode: 'TQBR', id: ticker })
      });
      let instrumentData = await instrumentRes.json();
      let instrumentId = instrumentData.instrument?.uid || instrumentData.instrument?.figi;

      if (!instrumentId) {
         return; // skip if not found
      }

      // 2. Get Dividends
      const divRes = await fetch('https://invest-public-api.tinkoff.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/GetDividends', {
        method: 'POST',
        headers,
        body: JSON.stringify({ instrumentId, from, to })
      });

      const divData = await divRes.json();
      
      if (divData.dividends && divData.dividends.length > 0) {
        for (const div of divData.dividends) {
          // Calculate values
          const netUnits = parseInt(div.dividendNet?.units || '0', 10);
          const netNano = (div.dividendNet?.nano || 0) / 1e9;
          const net = netUnits + netNano;

          const yieldUnits = parseInt(div.yieldValue?.units || '0', 10);
          const yieldNano = (div.yieldValue?.nano || 0) / 1e9;
          const divYield = yieldUnits + yieldNano;

          results.push({
            ticker,
            paymentDate: div.paymentDate,
            recordDate: div.recordDate,
            dividendNet: net,
            yieldValue: divYield,
            currency: div.dividendNet?.currency?.toUpperCase() || 'RUB',
          });
        }
      }
    } catch (e) {
      console.warn(`Failed to fetch Tinkoff dividend for ${ticker}:`, e);
      // Skip on error
    }
  }));

  return results;
}
