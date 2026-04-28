import { MarketData, FALLBACK_MARKET_DATA, SIMULATED_MARKET_DATA } from './mockData';

// Cache to store market data so we don't spam APIs
const cache: Record<string, MarketData> = {};

// We can map common Russian ticker aliases to actual TQBR tickers
const MOEX_TICKER_MAP: Record<string, string> = {
  'СБЕРБАНК-П': 'SBERP',
  'СБЕРБАНК': 'SBER',
  'ЛУКОЙЛ': 'LKOH',
  'ГАЗПРОМ': 'GAZP',
  'СЕВЕРСТАЛЬ': 'CHMF',
  'МАГНИТ4П03': 'MGNT', // fallback
  'ТАТНЕФТЬАП': 'TATNP',
  'ТРАНСНЕФАП': 'TRNFP',
};

// Global cache for MOEX data since we can fetch it all at once
let moexDataCache: Record<string, any> | null = null;
let moexDataLoading: Promise<void> | null = null;

async function fetchMoexDataAll() {
  if (moexDataCache) return;
  if (moexDataLoading) return moexDataLoading;

  moexDataLoading = fetch('https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities.json')
    .then(res => res.json())
    .then(data => {
       const marketDataObj: Record<string, any> = {};
       const securities = data.securities.data;
       const marketdata = data.marketdata.data;

       // Find indices
       const secidIdxSec = data.securities.columns.indexOf('SECID');
       const shortnameIdx = data.securities.columns.indexOf('SHORTNAME');
       const secidIdxMkt = data.marketdata.columns.indexOf('SECID');
       const lastPriceIdx = data.marketdata.columns.indexOf('LAST');

       for (let i = 0; i < marketdata.length; i++) {
          const secid = marketdata[i][secidIdxMkt];
          const price = marketdata[i][lastPriceIdx];
          marketDataObj[secid] = { price: price || 0 };
       }
       moexDataCache = marketDataObj;
    })
    .catch(err => {
       console.error("MOEX fetch failed", err);
       moexDataCache = {};
    });

  return moexDataLoading;
}

export async function fetchAlphaVantageQuote(ticker: string, apiKey: string): Promise<number | null> {
    try {
        const res = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${apiKey}`);
        const data = await res.json();
        const price = data['Global Quote']?.['05. price'];
        if (price) return parseFloat(price);
    } catch(e) {
        console.error("AlphaVantage error", e);
    }
    return null;
}

export async function getRealMarketData(rawTicker: string, isin?: string): Promise<MarketData> {
  const upperTicker = rawTicker.trim().toUpperCase();
  const searchTicker = MOEX_TICKER_MAP[upperTicker] || upperTicker;

  const cacheKey = isin || searchTicker;
  if (cache[cacheKey]) return cache[cacheKey];

  const baselineData = { ...(SIMULATED_MARKET_DATA[searchTicker] || FALLBACK_MARKET_DATA) };

  let priceFound = false;

  // Search MOEX cache directly instead of making an API call per ticker!
  try {
      await fetchMoexDataAll();
      if (moexDataCache && moexDataCache[searchTicker]) {
          const mPrice = moexDataCache[searchTicker].price;
          if (mPrice && mPrice > 0) {
              baselineData.price = mPrice;
              priceFound = true;
              baselineData.sector = 'Акции РФ';
          }
      }
  } catch(e) {
      console.error("MOEX search error:", e);
  }

  // AlphaVantage fallback
  if (!priceFound && !SIMULATED_MARKET_DATA[searchTicker]) {
      const alphaPrice = await fetchAlphaVantageQuote(searchTicker, '4VYUTOGN71LRZPPF');
      if (alphaPrice !== null) {
          baselineData.price = alphaPrice;
          baselineData.sector = 'US Stocks';
      }
  }

  cache[cacheKey] = baselineData;
  return baselineData;
}
