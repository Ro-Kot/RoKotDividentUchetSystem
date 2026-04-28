export interface MarketData {
  price: number;
  dividendYield: number; // percentage (e.g. 5.5 for 5.5%)
  sector: string;
}

// Simulated data to make the clone work without API keys immediately.
// In reality, this data is fetched from Yahoo Finance, Polygon.io, Financial Modeling Prep, or specialized dividend APIs.
export const SIMULATED_MARKET_DATA: Record<string, MarketData> = {
  'AAPL': { price: 175.50, dividendYield: 0.53, sector: 'Technology' },
  'MSFT': { price: 405.00, dividendYield: 0.74, sector: 'Technology' },
  'KO':   { price: 60.10,  dividendYield: 3.10, sector: 'Consumer Defensive' },
  'JNJ':  { price: 155.20, dividendYield: 3.05, sector: 'Healthcare' },
  'O':    { price: 53.40,  dividendYield: 5.75, sector: 'Real Estate' },
  'T':    { price: 17.20,  dividendYield: 6.45, sector: 'Communication' },
  'XOM':  { price: 110.50, dividendYield: 3.40, sector: 'Energy' },
  'SBER': { price: 290.50, dividendYield: 11.5, sector: 'Financials' },
  'GAZP': { price: 165.20, dividendYield: 8.2,  sector: 'Energy' },
  'LKOH': { price: 7200.0, dividendYield: 14.1, sector: 'Energy' },
};

// Fallback for unknown tickers
export const FALLBACK_MARKET_DATA: MarketData = {
  price: 100, // generic fallback
  dividendYield: 4.5, // average dividend yield
  sector: 'Other'
};

export function getMarketData(ticker: string): MarketData {
  return SIMULATED_MARKET_DATA[ticker.toUpperCase()] || FALLBACK_MARKET_DATA;
}

export function generateMonthlyDividends(annualDividends: number) {
  // Distribute mostly quarterly with some variations
  return [
    { name: 'Jan', amount: annualDividends * 0.05 },
    { name: 'Feb', amount: annualDividends * 0.05 },
    { name: 'Mar', amount: annualDividends * 0.15 },
    { name: 'Apr', amount: annualDividends * 0.05 },
    { name: 'May', amount: annualDividends * 0.05 },
    { name: 'Jun', amount: annualDividends * 0.15 },
    { name: 'Jul', amount: annualDividends * 0.05 },
    { name: 'Aug', amount: annualDividends * 0.05 },
    { name: 'Sep', amount: annualDividends * 0.15 },
    { name: 'Oct', amount: annualDividends * 0.05 },
    { name: 'Nov', amount: annualDividends * 0.05 },
    { name: 'Dec', amount: annualDividends * 0.15 },
  ];
}
