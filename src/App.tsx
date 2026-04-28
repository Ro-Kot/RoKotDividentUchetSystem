/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Dashboard, { EnrichedPortfolioRow } from './components/Dashboard';
import DividendCalendar from './components/Calendar';
import { LayoutDashboard, Wallet, PieChart as PortfolioIcon, Calculator, Settings, Menu } from 'lucide-react';

function Sidebar({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) {
  const navItems = [
    { id: 'dashboard', label: 'Обзор портфеля', icon: LayoutDashboard },
    { id: 'forecasts', label: 'Прогнозы выплат', icon: Wallet },
    { id: 'analytics', label: 'Аналитика', icon: PortfolioIcon },
    { id: 'calendar', label: 'Календарь дивидендов', icon: Calculator },
    { id: 'settings', label: 'Настройки', icon: Settings },
  ];

  return (
    <nav className="hidden w-64 bg-[#0F1219] border-r border-slate-800 md:flex flex-col py-6">
      <div className="px-6 mb-10 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold">D</div>
        <span className="text-white font-bold text-lg tracking-tight uppercase">DIVIDEND PRO</span>
      </div>
      
      <div className="flex-1 space-y-1">
        {navItems.map(item => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full text-left flex items-center px-6 py-3 transition-colors ${
                isActive 
                  ? 'text-primary bg-primary/10 border-r-2 border-primary' 
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <span className={`mr-3 text-xs ${isActive ? '' : 'opacity-50'}`}>
                {isActive ? '◆' : '◇'}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-auto px-6">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
          <p className="text-xs text-muted-foreground uppercase font-semibold mb-2 tracking-wider">Статус данных</p>
          <p className="text-sm text-slate-300 flex items-center">
            <span className="w-2 h-2 bg-primary rounded-full mr-2"></span> Live Market Data
          </p>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [portfolio, setPortfolio] = useState<EnrichedPortfolioRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('finamApiKey') || '');
  const [tinkoffToken, setTinkoffToken] = useState('t.VES70oreEPf2M53v110eLosVXuWf-wIQHkoRBekiLWbBeJ07XKwEswlZaibfEqt8oodu141FNZSH8mevErwalw');

  useEffect(() => {
    localStorage.setItem('finamApiKey', apiKey);
  }, [apiKey]);

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row font-sans bg-[#0A0C10] text-slate-300">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex flex-col sm:gap-4 flex-1">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-800 bg-[#0A0C10] px-4 sm:px-8">
          <div className="flex items-center gap-4 md:hidden">
            <button>
              <Menu className="h-6 w-6" />
            </button>
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold">D</div>
          </div>
          
          <h1 className="text-xl font-medium text-white hidden md:block">
            {activeTab === 'dashboard' && 'Аналитика дивидендов'}
            {activeTab === 'forecasts' && 'Прогнозы выплат'}
            {activeTab === 'analytics' && 'Аналитика портфеля'}
            {activeTab === 'calendar' && 'Календарь'}
            {activeTab === 'settings' && 'Настройки'}
          </h1>

          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-muted-foreground uppercase">Текущий профиль</p>
              <p className="text-sm font-bold text-white">Инвестор</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center">
               <span className="text-slate-500 text-xs">👤</span>
            </div>
          </div>
        </header>
        <main className="flex-1 flex flex-col relative">
          {activeTab === 'dashboard' && <Dashboard portfolio={portfolio} setPortfolio={setPortfolio} isLoading={isLoading} setIsLoading={setIsLoading} apiKey={apiKey} setApiKey={setApiKey} tinkoffToken={tinkoffToken} />}
          {activeTab === 'calendar' && <DividendCalendar portfolio={portfolio} tinkoffToken={tinkoffToken} setTinkoffToken={setTinkoffToken} />}
          {activeTab !== 'dashboard' && activeTab !== 'calendar' && (
            <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
               <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 text-slate-500">
                  <span className="text-2xl">⏳</span>
               </div>
               <h2 className="text-xl text-white font-medium mb-2">Раздел в разработке</h2>
               <p className="text-slate-400 max-w-sm">Мы активно работаем над вкладкой "{activeTab}". Вернитесь сюда чуть позже.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
