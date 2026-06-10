import { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, Briefcase, Receipt, RefreshCw, Download, Calendar, BookOpen, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Sale, Service, Expense } from '../types';
import { formatDateShort, exportToCSV } from '../lib/utils';
import { ComptaDashboard } from './ComptaDashboard';
import { ComptaPrestations } from './ComptaPrestations';
import { ComptaDepenses } from './ComptaDepenses';

type Period = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
type SubTab = 'dashboard' | 'services' | 'expenses';

interface PeriodRange { start: Date; end: Date; }

const PERIOD_OPTIONS: { id: Period; label: string }[] = [
  { id: 'today', label: "Aujourd'hui" },
  { id: 'week', label: '7 jours' },
  { id: 'month', label: 'Ce mois' },
  { id: 'quarter', label: 'Trimestre' },
  { id: 'year', label: 'Annee' },
  { id: 'custom', label: 'Personnalise' },
];

const SUB_TABS = [
  { id: 'dashboard' as SubTab, label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'services' as SubTab, label: 'Prestations', icon: Briefcase },
  { id: 'expenses' as SubTab, label: 'Depenses', icon: Receipt },
];

function getPeriodRange(period: Period, customStart: string, customEnd: string): PeriodRange {
  const now = new Date();
  switch (period) {
    case 'today': {
      const s = new Date(now); s.setHours(0, 0, 0, 0);
      const e = new Date(now); e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    case 'week': {
      const s = new Date(now); s.setDate(now.getDate() - 6); s.setHours(0, 0, 0, 0);
      const e = new Date(now); e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    case 'month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now); e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3);
      const s = new Date(now.getFullYear(), q * 3, 1);
      const e = new Date(now); e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    case 'year': {
      const s = new Date(now.getFullYear(), 0, 1);
      const e = new Date(now); e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    case 'custom': {
      const s = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
      s.setHours(0, 0, 0, 0);
      const e = customEnd ? new Date(customEnd) : new Date(now);
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
  }
}

export function Comptabilite() {
  const [period, setPeriod] = useState<Period>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [subTab, setSubTab] = useState<SubTab>('dashboard');
  const [loading, setLoading] = useState(true);

  const [sales, setSales] = useState<Sale[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const range = useMemo(
    () => getPeriodRange(period, customStart, customEnd),
    [period, customStart, customEnd]
  );

  useEffect(() => { fetchAll(); }, [range.start.getTime(), range.end.getTime()]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [salesRes, servicesRes, expensesRes] = await Promise.all([
        supabase.from('sales').select('*')
          .gte('created_at', range.start.toISOString())
          .lte('created_at', range.end.toISOString())
          .order('created_at', { ascending: true }),
        supabase.from('services').select('*')
          .gte('service_date', range.start.toISOString().split('T')[0])
          .lte('service_date', range.end.toISOString().split('T')[0])
          .order('service_date', { ascending: false }),
        supabase.from('expenses').select('*')
          .gte('expense_date', range.start.toISOString().split('T')[0])
          .lte('expense_date', range.end.toISOString().split('T')[0])
          .order('expense_date', { ascending: false }),
      ]);
      if (salesRes.error) throw salesRes.error;
      if (servicesRes.error) throw servicesRes.error;
      if (expensesRes.error) throw expensesRes.error;
      setSales(salesRes.data || []);
      setServices(servicesRes.data || []);
      setExpenses(expensesRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const totalRecettes = sales.reduce((s, v) => s + v.total, 0) + services.reduce((s, v) => s + v.amount, 0);
  const totalDepenses = expenses.reduce((s, v) => s + v.amount, 0);
  const resultatNet = totalRecettes - totalDepenses;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Comptabilite</h2>
              <p className="text-sm text-slate-400">
                {formatDateShort(range.start.toISOString())} — {formatDateShort(range.end.toISOString())}
                &nbsp;·&nbsp;
                <span className={`font-medium ${resultatNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {resultatNet >= 0 ? '+' : ''}{Math.round(resultatNet).toLocaleString('fr-FR')} FCFA net
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchAll} disabled={loading}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {subTab === 'dashboard' && (
              <button onClick={() => exportToCSV(sales)} disabled={sales.length === 0}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
                <Download className="w-4 h-4" /> Export ventes
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Period selector */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
        <div className="flex flex-wrap gap-2 items-center">
          {PERIOD_OPTIONS.map(opt => (
            <button key={opt.id} onClick={() => setPeriod(opt.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${period === opt.id ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'}`}>
              {opt.label}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                  className="pl-8 pr-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <span className="text-slate-400">→</span>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                  className="pl-8 pr-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-2xl p-1.5">
        {SUB_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setSubTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {loading && subTab === 'dashboard' ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {subTab === 'dashboard' && (
            <ComptaDashboard sales={sales} services={services} expenses={expenses} range={range} loading={loading} />
          )}
          {subTab === 'services' && (
            <ComptaPrestations services={services} range={range} onUpdate={fetchAll} />
          )}
          {subTab === 'expenses' && (
            <ComptaDepenses expenses={expenses} range={range} onUpdate={fetchAll} />
          )}
        </>
      )}
    </div>
  );
}
