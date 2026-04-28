import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, TrendingUp, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

export interface DividendEvent {
  id: string;
  ticker: string;
  companyName: string;
  exDividendDate: string;
  paymentDate: string;
  amount: number;
  currency: string;
  yield: number;
}

const mockDividends: DividendEvent[] = [
  { id: '1', ticker: 'SBER', companyName: 'Сбербанк', exDividendDate: '2026-05-10', paymentDate: '2026-05-25', amount: 33.3, currency: 'RUB', yield: 11.5 },
  { id: '2', ticker: 'LKOH', companyName: 'Лукойл', exDividendDate: '2026-06-01', paymentDate: '2026-06-15', amount: 498.0, currency: 'RUB', yield: 8.9 },
  { id: '3', ticker: 'GAZP', companyName: 'Газпром', exDividendDate: '2026-07-15', paymentDate: '2026-07-30', amount: 15.0, currency: 'RUB', yield: 9.2 },
  { id: '4', ticker: 'TATNP', companyName: 'Татнефть (ап)', exDividendDate: '2026-05-15', paymentDate: '2026-05-28', amount: 35.1, currency: 'RUB', yield: 6.2 },
  { id: '5', ticker: 'CHMF', companyName: 'Северсталь', exDividendDate: '2026-06-20', paymentDate: '2026-07-05', amount: 120.5, currency: 'RUB', yield: 10.1 },
  { id: '6', ticker: 'ROSN', companyName: 'Роснефть', exDividendDate: '2026-05-05', paymentDate: '2026-05-20', amount: 25.0, currency: 'RUB', yield: 4.5 },
];

import { EnrichedPortfolioRow } from './Dashboard';
import { fetchTinkoffDividends, TinkoffDividend } from '../services/tinkoff';

export default function DividendCalendar({ 
  portfolio, 
  tinkoffToken, 
  setTinkoffToken 
}: { 
  portfolio?: EnrichedPortfolioRow[],
  tinkoffToken: string,
  setTinkoffToken: React.Dispatch<React.SetStateAction<string>>
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 4)); // Starts at May 2026
  const [tinkoffDivs, setTinkoffDivs] = useState<TinkoffDividend[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleTinkoffFetch = async () => {
    if (!tinkoffToken) {
      alert("Пожалуйста, введите токен Т-Банк API");
      return;
    }
    
    setIsLoading(true);
    try {
      // Extract unique tickers from portfolio, or use defaults if empty
      const tickersToFetch = portfolio && portfolio.length > 0 
        ? Array.from(new Set(portfolio.map(p => p.ticker)))
        : ['SBER', 'LKOH', 'GAZP', 'TATN', 'TATNP', 'CHMF', 'ROSN'];

      const dividends = await fetchTinkoffDividends(tinkoffToken, tickersToFetch);
      setTinkoffDivs(dividends);
    } catch (e: any) {
      alert("Ошибка при получении дивидендов: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const currentMonthStr = currentMonth.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
  
  // Decide which dividend set to display
  let displayDividends: DividendEvent[] = mockDividends;
  
  if (tinkoffDivs.length > 0) {
    displayDividends = tinkoffDivs.map((tDiv, index) => ({
      id: `tinkoff-${index}`,
      ticker: tDiv.ticker,
      companyName: tDiv.ticker, // Could use mapping for full name later
      exDividendDate: tDiv.recordDate,
      paymentDate: tDiv.paymentDate,
      amount: tDiv.dividendNet,
      currency: tDiv.currency,
      yield: tDiv.yieldValue
    }));
  }

  // Calculate actual dividends based on portfolio if present
  if (portfolio && portfolio.length > 0) {
    displayDividends = displayDividends
      .filter(m => portfolio.some(p => p.ticker === m.ticker))
      .map(m => {
        const p = portfolio.find(p => p.ticker === m.ticker);
        return {
          ...m,
          amount: m.amount * (p?.shares || 1)
        };
      });
  }

  // Filter events for current month (based on payment date)
  const currentMonthEvents = displayDividends.filter(event => {
    const d = new Date(event.paymentDate);
    return d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear();
  }).sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());

  const totalCurrentMonth = currentMonthEvents.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Календарь дивидендов</h2>
          <p className="text-muted-foreground mt-1">Отслеживайте предстоящие выплаты и планируйте денежные потоки.</p>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Токен Т-Банк Инвестиции (t....)"
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm text-white w-64 focus:outline-none focus:border-primary"
            value={tinkoffToken}
            onChange={e => setTinkoffToken(e.target.value)}
          />
          <Button onClick={handleTinkoffFetch} disabled={isLoading || !tinkoffToken} className="font-semibold bg-[#ffdd00] text-black hover:bg-[#ffdd00]/90 transition-colors">
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Т-Банк Прогноз
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="col-span-1 md:col-span-2 bg-[#121620] border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-4 bg-[#1A1F2C]">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              <CardTitle className="text-white text-lg">Календарь выплат</CardTitle>
            </div>
            <div className="flex items-center space-x-4">
              <Button onClick={prevMonth} variant="outline" size="icon" className="h-8 w-8 bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium text-white capitalize min-w-[120px] text-center">{currentMonthStr}</span>
              <Button onClick={nextMonth} variant="outline" size="icon" className="h-8 w-8 bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {currentMonthEvents.length > 0 ? (
              <div className="divide-y divide-slate-800">
                {currentMonthEvents.map((event) => (
                  <div key={event.id} className="p-4 hover:bg-[#1A1F2C]/50 transition-colors flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-slate-800 rounded-lg flex flex-col items-center justify-center text-xs">
                        <span className="text-slate-400 font-medium">{new Date(event.paymentDate).getDate()}</span>
                        <span className="text-slate-500 uppercase">{new Date(event.paymentDate).toLocaleString('ru-RU', { month: 'short' })}</span>
                      </div>
                      <div>
                        <h4 className="text-white font-medium">{event.companyName}</h4>
                        <p className="text-sm text-slate-500">{event.ticker} • экс-див: {new Date(event.exDividendDate).toLocaleDateString('ru-RU')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold text-lg">{event.amount.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} {event.currency}</p>
                      <p className="text-sm text-emerald-400 flex items-center justify-end">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {event.yield}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>В этом месяце выплат не ожидается</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-primary/20 to-[#121620] border-primary/30 rounded-xl overflow-hidden">
            <CardHeader>
              <CardTitle className="text-white text-lg">Итог за месяц</CardTitle>
              <p className="text-slate-400 text-sm">Суммарные выплаты по выбранному месяцу</p>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-bold text-white">{totalCurrentMonth.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}</span>
                <span className="text-primary font-medium">RUB</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {portfolio && portfolio.length > 0 
                  ? "Сумма рассчитана на основе текущего количества акций в портфеле."
                  : "Ожидаемая выплата (демо-данные на 1 акцию). Загрузите портфель для точного расчета."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
