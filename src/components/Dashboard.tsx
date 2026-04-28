import React, { useState, useRef, useEffect } from 'react';
import { Upload, PieChart as PieChartIcon, TrendingUp, DollarSign, Activity, FileSpreadsheet, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { parsePortfolioFile, PortfolioRow } from '../utils/excelParser';
import { generateMonthlyDividends } from '../utils/mockData';
import { getRealMarketData } from '../utils/api';
import { fetchFinamPortfolio } from '../services/finam';
import { fetchTinkoffDividends } from '../services/tinkoff';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export interface EnrichedPortfolioRow extends PortfolioRow {
    currentPrice: number;
    dividendYield: number;
    sector: string;
}

export default function Dashboard({ 
  portfolio, 
  setPortfolio, 
  isLoading, 
  setIsLoading, 
  apiKey, 
  setApiKey 
}: { 
  portfolio: EnrichedPortfolioRow[], 
  setPortfolio: React.Dispatch<React.SetStateAction<EnrichedPortfolioRow[]>>,
  isLoading: boolean,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  apiKey: string,
  setApiKey: React.Dispatch<React.SetStateAction<string>>,
  tinkoffToken: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetchedOnMount = useRef<boolean>(false);

  useEffect(() => {
    if (apiKey && portfolio.length === 0 && !fetchedOnMount.current) {
      fetchedOnMount.current = true;
      handleFinamFetch();
    }
  }, [apiKey, portfolio.length]);

  const handleFinamFetch = async () => {
    if (!apiKey) {
      alert("Пожалуйста, введите API ключ Finam (tapi_sk_...)");
      return;
    }
    
    setIsLoading(true);
    try {
      const data = await fetchFinamPortfolio(apiKey);
      console.log("Finam data:", data);
      if (!data) throw new Error("Не удалось получить данные с сервера Finam");
      
      let enrichedRows = await Promise.all(data.positions.map(async (pos) => {
          const ticker = pos.symbol.split('@')[0];
          console.log("Fetching market data for", ticker);
          const mkt = await getRealMarketData(ticker, '');
          
          let currentPrice = pos.current_price || mkt.price || pos.average_price;
          let averagePrice = pos.average_price;
          
          // Bonds price is typically given as a percentage of nominal value (1000 RUB)
          if (ticker.startsWith('RU000A') || ticker.startsWith('SU')) {
            currentPrice = currentPrice * 10;
            averagePrice = averagePrice * 10;
          }

          return {
              ticker,
              shares: pos.quantity,
              averagePrice,
              currency: 'RUB',
              currentPrice,
              dividendYield: mkt.dividendYield,
              sector: mkt.sector
          };
      }));

      if (tinkoffToken && enrichedRows.length > 0) {
        try {
          const tickers = Array.from(new Set(enrichedRows.map(r => r.ticker)));
          console.log("Fetching Tinkoff forecasts for:", tickers);
          const tDivs = await fetchTinkoffDividends(tinkoffToken, tickers);
          console.log("Tinkoff dividends received:", tDivs);
          const tDivYieldsByTicker = tDivs.reduce((acc, curr) => {
             // For multiple dividends of the same ticker, sum up the yield?
             acc[curr.ticker] = (acc[curr.ticker] || 0) + curr.yieldValue;
             return acc;
          }, {} as Record<string, number>);

          enrichedRows = enrichedRows.map(row => {
             if (tDivYieldsByTicker[row.ticker] !== undefined) {
                 return { ...row, dividendYield: tDivYieldsByTicker[row.ticker] };
             }
             return row;
          });
        } catch (e) {
          console.warn("Failed to apply Tinkoff forecasts:", e);
        }
      }

      setPortfolio(enrichedRows);
    } catch (error: any) {
      console.error("Error fetching Finam", error);
      alert(error.message || "Ошибка при подключении к Finam. Убедитесь, что токен Trade API верен.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const rows = await parsePortfolioFile(file);
      console.log("Parsed rows:", rows);
      
      // Enrich with real market data
      let enrichedRows = await Promise.all(rows.map(async (row) => {
          console.log("Fetching market data for", row.ticker, row.isin);
          const mkt = await getRealMarketData(row.ticker, row.isin);
          return {
              ...row,
              currentPrice: mkt.price,
              dividendYield: mkt.dividendYield,
              sector: mkt.sector
          };
      }));

      if (tinkoffToken && enrichedRows.length > 0) {
        try {
          const tickers = Array.from(new Set(enrichedRows.map(r => r.ticker)));
          console.log("Fetching Tinkoff forecasts for:", tickers);
          const tDivs = await fetchTinkoffDividends(tinkoffToken, tickers);
          console.log("Tinkoff dividends received:", tDivs);
          const tDivYieldsByTicker = tDivs.reduce((acc, curr) => {
             acc[curr.ticker] = (acc[curr.ticker] || 0) + curr.yieldValue;
             return acc;
          }, {} as Record<string, number>);

          enrichedRows = enrichedRows.map(row => {
             if (tDivYieldsByTicker[row.ticker] !== undefined) {
                 return { ...row, dividendYield: tDivYieldsByTicker[row.ticker] };
             }
             return row;
          });
        } catch (e) {
          console.warn("Failed to apply Tinkoff forecasts:", e);
        }
      }

      setPortfolio(enrichedRows);
    } catch (error: any) {
      console.error("Error parsing file", error);
      alert(error.message || "Ошибка при чтении файла. Убедитесь, что формат правильный.");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Calculations
  let totalInvested = 0;
  let currentPortfolioValue = 0;
  let annualDividends = 0;
  const sectorAllocation: Record<string, number> = {};

  portfolio.forEach(pos => {
    const positionInvested = pos.shares * pos.averagePrice;
    const positionCurrentValue = pos.shares * pos.currentPrice;
    const positionDividends = positionCurrentValue * (pos.dividendYield / 100);

    totalInvested += positionInvested;
    currentPortfolioValue += positionCurrentValue;
    annualDividends += positionDividends;

    sectorAllocation[pos.sector] = (sectorAllocation[pos.sector] || 0) + positionCurrentValue;
  });

  const profitLoss = currentPortfolioValue - totalInvested;
  const profitLossPercent = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;
  const averageDividendYield = currentPortfolioValue > 0 ? (annualDividends / currentPortfolioValue) * 100 : 0;

  const pieData = Object.entries(sectorAllocation).map(([name, value]) => ({ name, value }));
  const COLORS = ['#10b981', '#3b82f6', '#6366f1', '#f59e0b', '#8b5cf6', '#14b8a6'];

  const monthlyDividends = generateMonthlyDividends(annualDividends);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Сводка портфеля</h2>
          <p className="text-muted-foreground mt-1">Добро пожаловать в клон Snowball Income. Подгрузите ваш отчет для анализа.</p>
        </div>
        <div className="flex flex-col items-end space-y-2">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="API Ключ Finam (tapi_sk_...)"
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm text-white w-64 focus:outline-none focus:border-primary"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            <Button onClick={handleFinamFetch} disabled={isLoading || !apiKey} className="font-semibold bg-primary text-white hover:bg-primary/90 transition-colors">
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Finam
            </Button>
          </div>
          <div className="flex items-center space-x-2 w-full justify-end">
            <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">или</span>
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv, .xml" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <Button onClick={() => fileInputRef.current?.click()} disabled={isLoading} variant="outline" className="font-semibold border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 transition-colors">
              <Upload className="mr-2 h-4 w-4" />
              Загрузить Broker Excel
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs text-slate-500 uppercase tracking-widest font-medium">Стоимость портфеля</CardTitle>
            <DollarSign className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-light text-white mt-1">
              {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(currentPortfolioValue || 0)}
            </div>
            <p className="text-xs text-slate-400 mt-4">
              Вложено: <span className="font-mono">{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(totalInvested || 0)}</span>
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs text-slate-500 uppercase tracking-widest font-medium">Прибыль / Убыток</CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-light mt-1 ${profitLoss >= 0 ? 'text-primary' : 'text-red-400'}`}>
              {profitLoss > 0 ? '+' : ''}{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(profitLoss || 0)}
            </div>
            <div className="text-xs text-slate-400 mt-4 flex items-center">
              <span className={`mr-1 font-medium ${profitLossPercent >= 0 ? 'text-primary' : 'text-red-400'}`}>
                {profitLossPercent > 0 ? '+' : ''}{profitLossPercent.toFixed(2)}%
              </span> с начала инвестирования
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs text-slate-500 uppercase tracking-widest font-medium">Годовая див. доходность</CardTitle>
            <Activity className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-light text-blue-400 mt-1">{averageDividendYield.toFixed(2)}%</div>
            <div className="mt-4 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
               <div className="h-full bg-blue-500" style={{ width: `${Math.min(averageDividendYield * 10, 100)}%` }}></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs text-slate-500 uppercase tracking-widest font-medium">Ожидаемые дивиденды</CardTitle>
            <PieChartIcon className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-light text-primary mt-1">
              {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(annualDividends || 0)}
            </div>
            <p className="text-xs text-slate-400 mt-4 italic font-serif">
              В среднем: {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format((annualDividends / 12) || 0)} / мес
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 bg-[#11141D] border-slate-800 overflow-hidden">
          <CardHeader className="px-6 py-4 border-b border-slate-800 bg-slate-900/30">
            <CardTitle className="font-medium text-slate-200">Выплаты дивидендов по месяцам (Прогноз)</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {portfolio.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyDividends}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(value) => `${value} Р`}
                    />
                    <RechartsTooltip 
                      cursor={{ fill: '#1e293b' }}
                      contentStyle={{ backgroundColor: '#0A0C10', borderColor: '#1e293b', borderRadius: '8px' }}
                      formatter={(value: number) => [`${value.toFixed(2)} Р`, 'Дивиденды']} 
                    />
                    <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[300px] flex-col items-center justify-center text-center">
                <FileSpreadsheet className="h-10 w-10 text-slate-700 mb-4" />
                <p className="text-slate-500">Загрузите отчет для построения графика дивидендов</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="col-span-3 bg-[#11141D] border-slate-800 overflow-hidden">
          <CardHeader className="px-6 py-4 border-b border-slate-800 bg-slate-900/30">
            <CardTitle className="font-medium text-slate-200">Распределение по секторам</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {portfolio.length > 0 ? (
               <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      fill="#8884d8"
                      paddingAngle={5}
                      stroke="none"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#0A0C10', borderColor: '#1e293b', borderRadius: '8px' }}
                      formatter={(value: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(value)} 
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 flex flex-col gap-2">
                  {pieData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="text-slate-300">{entry.name}</span>
                      </div>
                      <span className="font-mono text-slate-400">
                         {((entry.value / currentPortfolioValue) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
               </div>
            ) : (
              <div className="flex h-[300px] flex-col items-center justify-center text-center">
                <PieChartIcon className="h-10 w-10 text-slate-700 mb-4" />
                <p className="text-slate-500">Нет данных для отображения</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {portfolio.length > 0 && (
          <Card>
           <CardHeader className="px-6 py-4 border-b border-slate-800 bg-slate-900/30">
             <CardTitle className="font-medium text-slate-200">Текущие позиции</CardTitle>
           </CardHeader>
           <CardContent className="p-0">
             <div className="overflow-x-auto p-2">
               <table className="w-full text-left text-sm">
                 <thead className="text-slate-500 font-mono text-[11px] uppercase">
                   <tr>
                     <th className="px-4 py-2">Актив</th>
                     <th className="px-4 py-2">Активы</th>
                     <th className="px-4 py-2">Ср. цена</th>
                     <th className="px-4 py-2">Тек. цена</th>
                     <th className="px-4 py-2">Стоимость</th>
                     <th className="px-4 py-2">Прибыль / Убыток</th>
                     <th className="px-4 py-2 font-bold tracking-wider">Див. %</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-800/50">
                   {portfolio.map((pos, idx) => {
                     const invested = pos.shares * pos.averagePrice;
                     const currentVal = pos.shares * pos.currentPrice;
                     const pl = currentVal - invested;
                     const plPercent = invested > 0 ? (pl / invested) * 100 : 0;

                     return (
                       <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                         <td className="px-4 py-3">{pos.ticker} <span className="text-slate-500 text-xs ml-1 font-normal">{pos.sector}</span></td>
                         <td className="px-4 py-3 font-mono">{pos.shares}</td>
                         <td className="px-4 py-3 font-mono">₽ {pos.averagePrice.toFixed(2)}</td>
                         <td className="px-4 py-3 font-mono">₽ {pos.currentPrice.toFixed(2)}</td>
                         <td className="px-4 py-3 font-mono font-medium text-white">₽ {currentVal.toFixed(2)}</td>
                         <td className={`px-4 py-3 font-mono ${pl >= 0 ? 'text-primary' : 'text-red-400'}`}>
                           {pl > 0 ? '+' : ''}₽ {pl.toFixed(2)} <span className="opacity-80">({plPercent > 0 ? '+' : ''}{plPercent.toFixed(2)}%)</span>
                         </td>
                         <td className="px-4 py-3 font-mono text-blue-400">{pos.dividendYield}%</td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
           </CardContent>
         </Card>
      )}

      <Card className="bg-slate-800/30 border-slate-700/50">
        <CardContent className="p-4 flex gap-4 items-start pt-4">
           <AlertCircle className="w-5 h-5 text-primary mt-0.5 min-w-[20px]" />
           <div className="text-sm">
             <p className="font-medium mb-1 text-white text-sm">Интеграция с MOEX и AlphaVantage</p>
             <p className="text-slate-400 leading-relaxed mb-2">Теперь котировки подтягиваются напрямую с Мосбиржи через публичное API (<b>iss.moex.com</b>), а иностранные акции загружаются через интеграцию с <b>AlphaVantage</b>.</p>
             <p className="text-slate-400 leading-relaxed">Дивидендная политика, по-прежнему, моделируется, так как открытые API редко отдают прогнозы див. выплат бесплатно.</p>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
