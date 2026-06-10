import { useState } from 'react';
import { TrendingUp, TrendingDown, Wallet, BarChart2, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Sale, Service, Expense } from '../types';
import { formatCurrency, formatDateShort } from '../lib/utils';

interface PeriodRange { start: Date; end: Date; }
type Granularity = 'hour' | 'day' | 'week' | 'month';
interface ChartBar { label: string; value: number; key: string; }

function getGranularity(start: Date, end: Date): Granularity {
  const days = (end.getTime() - start.getTime()) / 86400000;
  if (days < 1) return 'hour';
  if (days <= 31) return 'day';
  if (days <= 90) return 'week';
  return 'month';
}

function bucketKey(date: Date, g: Granularity): string {
  const p = (n: number) => String(n).padStart(2, '0');
  if (g === 'hour') return `${p(date.getHours())}h`;
  if (g === 'day') return `${p(date.getDate())}/${p(date.getMonth() + 1)}`;
  if (g === 'week') {
    const s = new Date(date); s.setDate(date.getDate() - date.getDay() + 1);
    return `${p(s.getDate())}/${p(s.getMonth() + 1)}`;
  }
  return ['Jan','Fev','Mar','Avr','Mai','Jun','Jul','Aou','Sep','Oct','Nov','Dec'][date.getMonth()];
}

function buildBars(range: PeriodRange, g: Granularity): ChartBar[] {
  if (g === 'hour') return Array.from({ length: 24 }, (_, h) => ({ label: `${String(h).padStart(2,'0')}h`, value: 0, key: `${String(h).padStart(2,'0')}h` }));
  const bars: ChartBar[] = [];
  const seen = new Set<string>();
  const cur = new Date(range.start);
  while (cur <= range.end) {
    const key = bucketKey(cur, g);
    if (!seen.has(key)) { seen.add(key); bars.push({ label: key, value: 0, key }); }
    if (g === 'day') cur.setDate(cur.getDate() + 1);
    else if (g === 'week') cur.setDate(cur.getDate() + 7);
    else cur.setMonth(cur.getMonth() + 1);
  }
  return bars;
}

function BarChart({ bars, maxVal }: { bars: ChartBar[]; maxVal: number }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const max = maxVal || 1;
  const showEveryN = Math.ceil(bars.length / 10);
  return (
    <div className="relative" style={{ height: 208 }}>
      <div className="absolute left-0 top-0 flex flex-col justify-between h-40">
        {[max, max / 2, 0].map((v, i) => (
          <span key={i} className="text-xs text-slate-500 text-right w-16 leading-none">
            {v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : Math.round(v)}
          </span>
        ))}
      </div>
      <div className="absolute left-20 right-0 flex items-end gap-0.5" style={{ height: 160 }}>
        {bars.map((bar, i) => {
          const pct = (bar.value / max) * 100;
          const hov = hoveredIdx === i;
          return (
            <div key={bar.key} className="flex-1 flex flex-col items-center justify-end h-full relative"
              onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}>
              {hov && bar.value > 0 && (
                <div className="absolute bottom-full mb-1 z-10 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white whitespace-nowrap shadow-xl pointer-events-none">
                  <p className="font-semibold">{bar.label}</p>
                  <p className="text-green-400">{formatCurrency(bar.value)}</p>
                </div>
              )}
              <div className={`w-full rounded-t transition-colors ${bar.value > 0 ? (hov ? 'bg-blue-400' : 'bg-blue-600') : 'bg-slate-700/40'}`}
                style={{ height: `${Math.max(pct, bar.value > 0 ? 1.5 : 0)}%`, minHeight: bar.value > 0 ? 3 : 0 }} />
            </div>
          );
        })}
      </div>
      <div className="absolute left-20 right-0 flex gap-0.5 top-40 pt-2">
        {bars.map((bar, i) => (
          <div key={bar.key} className="flex-1 text-center overflow-hidden">
            {i % showEveryN === 0 && <span className="text-xs text-slate-500 truncate block">{bar.label}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  sales: Sale[];
  services: Service[];
  expenses: Expense[];
  range: PeriodRange;
  loading: boolean;
}

export function ComptaDashboard({ sales, services, expenses, range, loading }: Props) {
  const caVentes = sales.reduce((s, v) => s + v.total, 0);
  const caPrestations = services.reduce((s, v) => s + v.amount, 0);
  const totalRecettes = caVentes + caPrestations;
  const totalDepenses = expenses.reduce((s, v) => s + v.amount, 0);
  const resultatNet = totalRecettes - totalDepenses;
  const totalPaid = sales.reduce((s, v) => s + v.amount_paid, 0);
  const creances = totalRecettes - totalPaid - caPrestations;

  const achats = expenses.filter(e => e.category === 'achat').reduce((s, e) => s + e.amount, 0);
  const divers = expenses.filter(e => e.category === 'divers').reduce((s, e) => s + e.amount, 0);

  // Combined bar chart (ventes + prestations per bucket)
  const g = getGranularity(range.start, range.end);
  const bars = buildBars(range, g);
  const bMap = new Map(bars.map(b => [b.key, b]));
  sales.forEach(s => {
    const b = bMap.get(bucketKey(new Date(s.created_at), g));
    if (b) b.value += s.total;
  });
  services.forEach(s => {
    const d = new Date(s.service_date + 'T12:00:00');
    const b = bMap.get(bucketKey(d, g));
    if (b) b.value += s.amount;
  });
  const maxVal = Math.max(...bars.map(b => b.value), 0);

  // Payment status for donut
  const paidFull = sales.filter(v => v.payment_status === 'paid').reduce((s, v) => s + v.total, 0);
  const paidAdv = sales.filter(v => v.payment_status === 'advance').reduce((s, v) => s + v.total, 0);
  const paidNone = sales.filter(v => v.payment_status === 'unpaid').reduce((s, v) => s + v.total, 0);
  const payTotal = paidFull + paidAdv + paidNone || 1;

  // Top services
  const topServices = [...services].sort((a, b) => b.amount - a.amount).slice(0, 5);
  // Top expenses
  const topExpenses = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5);

  if (loading) return (
    <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
  );

  const kpis = [
    { label: 'CA Ventes', value: caVentes, sub: `${sales.length} vente(s)`, color: 'blue', icon: BarChart2 },
    { label: 'Recettes Prestations', value: caPrestations, sub: `${services.length} prestation(s)`, color: 'cyan', icon: TrendingUp },
    { label: 'Total Recettes', value: totalRecettes, sub: 'Ventes + Prestations', color: 'green', icon: Wallet },
    { label: 'Total Depenses', value: totalDepenses, sub: `${expenses.length} depense(s)`, color: 'orange', icon: TrendingDown },
    { label: 'Resultat Net', value: resultatNet, sub: resultatNet >= 0 ? 'Benefice' : 'Deficit', color: resultatNet >= 0 ? 'emerald' : 'red', icon: resultatNet >= 0 ? TrendingUp : TrendingDown, highlight: true },
  ] as const;

  const colorMap = {
    blue: 'bg-blue-600/20 text-blue-400',
    cyan: 'bg-cyan-600/20 text-cyan-400',
    green: 'bg-green-600/20 text-green-400',
    orange: 'bg-orange-600/20 text-orange-400',
    emerald: 'bg-emerald-600/20 text-emerald-400',
    red: 'bg-red-600/20 text-red-400',
  } as const;

  const textMap = {
    blue: 'text-blue-400', cyan: 'text-cyan-400', green: 'text-green-400',
    orange: 'text-orange-400', emerald: 'text-emerald-400', red: 'text-red-400',
  } as const;

  const borderMap = {
    blue: '', cyan: '', green: '', orange: '',
    emerald: 'border-emerald-600/40', red: 'border-red-600/40',
  } as const;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className={`bg-slate-800 rounded-2xl border p-5 ${borderMap[kpi.color] || 'border-slate-700'}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[kpi.color]}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs text-slate-400 leading-tight">{kpi.label}</span>
              </div>
              <p className={`text-xl font-bold ${kpi.highlight ? textMap[kpi.color] : 'text-white'}`}>
                {formatCurrency(kpi.value)}
              </p>
              <p className="text-xs text-slate-500 mt-1">{kpi.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Bar chart + Payment donut */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <h3 className="text-base font-semibold text-white mb-1">Evolution des recettes</h3>
          <p className="text-xs text-slate-500 mb-6">Ventes + Prestations combinées</p>
          {totalRecettes === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <FileSpreadsheet className="w-10 h-10 mb-2 opacity-40" />
              <p>Aucune recette sur cette periode</p>
            </div>
          ) : (
            <BarChart bars={bars} maxVal={maxVal} />
          )}
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <h3 className="text-base font-semibold text-white mb-1">Répartition des dépenses</h3>
          <p className="text-xs text-slate-500 mb-5">Achats vs Divers</p>
          <div className="space-y-4">
            {[
              { label: 'Achats', value: achats, color: '#2563eb' },
              { label: 'Divers', value: divers, color: '#0891b2' },
            ].map(seg => (
              <div key={seg.label}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm text-slate-300 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: seg.color }} />
                    {seg.label}
                  </span>
                  <span className="text-sm font-semibold text-white">{formatCurrency(seg.value)}</span>
                </div>
                <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${totalDepenses > 0 ? (seg.value / totalDepenses) * 100 : 0}%`, backgroundColor: seg.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-slate-700 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Total dépenses</span>
              <span className="font-bold text-orange-400">{formatCurrency(totalDepenses)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Creances ventes</span>
              <span className="font-medium text-yellow-400">{formatCurrency(Math.max(0, creances))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment status (sales) */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
        <h3 className="text-base font-semibold text-white mb-4">Statut paiements ventes</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { label: 'Payé intégralement', value: paidFull, pct: (paidFull/payTotal)*100, color: '#16a34a', bg: 'bg-green-600/10 border-green-600/20' },
            { label: 'Acompte versé', value: paidAdv, pct: (paidAdv/payTotal)*100, color: '#ca8a04', bg: 'bg-yellow-600/10 border-yellow-600/20' },
            { label: 'Non payé', value: paidNone, pct: (paidNone/payTotal)*100, color: '#dc2626', bg: 'bg-red-600/10 border-red-600/20' },
          ].map(seg => (
            <div key={seg.label} className={`rounded-xl border p-4 ${seg.bg}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
                <span className="text-sm text-slate-300">{seg.label}</span>
              </div>
              <p className="text-xl font-bold text-white">{formatCurrency(seg.value)}</p>
              <p className="text-xs text-slate-500 mt-1">{seg.pct.toFixed(0)}% des ventes</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top services + Top expenses */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <h3 className="text-base font-semibold text-white mb-4">Top prestations</h3>
          {topServices.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">Aucune prestation sur cette période</p>
          ) : (
            <div className="space-y-3">
              {topServices.map((svc, i) => (
                <div key={svc.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 w-4 shrink-0">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-white truncate">{svc.name}</span>
                      <span className="text-sm font-bold text-cyan-400 ml-2 shrink-0">{formatCurrency(svc.amount)}</span>
                    </div>
                    {svc.client_name && <p className="text-xs text-slate-500">{svc.client_name} · {formatDateShort(svc.service_date)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <h3 className="text-base font-semibold text-white mb-4">Top dépenses</h3>
          {topExpenses.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">Aucune dépense sur cette période</p>
          ) : (
            <div className="space-y-3">
              {topExpenses.map((exp, i) => (
                <div key={exp.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 w-4 shrink-0">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-white truncate">{exp.name}</span>
                      <span className="text-sm font-bold text-orange-400 ml-2 shrink-0">{formatCurrency(exp.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${exp.category === 'achat' ? 'bg-blue-600/20 text-blue-400' : 'bg-slate-600/50 text-slate-400'}`}>
                        {exp.category === 'achat' ? 'Achat' : 'Divers'}
                      </span>
                      {exp.supplier && <span className="text-xs text-slate-500">{exp.supplier}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
