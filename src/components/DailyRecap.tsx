import { useState, useEffect } from 'react';
import {
  Calendar,
  Loader2,
  TrendingUp,
  ShoppingCart,
  Briefcase,
  Wallet,
  Clock,
  CheckCircle2,
  Printer,
  Download,
  Receipt,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Sale, Service, UserProfile } from '../types';
import { formatCurrency } from '../lib/utils';
import { useRealtime } from '../lib/useRealtime';

interface Props {
  currentUser: UserProfile;
}

export function DailyRecap({ currentUser }: Props) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  useRealtime(['sales', 'services'], fetchData);

  async function fetchData() {
    setLoading(true);
    try {
      const dayStart = new Date(selectedDate + 'T00:00:00');
      const dayEnd = new Date(selectedDate + 'T23:59:59');

      const [salesRes, servicesRes] = await Promise.all([
        supabase
          .from('sales')
          .select('*, sale_items(*)')
          .gte('created_at', dayStart.toISOString())
          .lte('created_at', dayEnd.toISOString())
          .order('created_at', { ascending: false }),
        supabase
          .from('services')
          .select('*')
          .eq('service_date', selectedDate)
          .order('created_at', { ascending: false }),
      ]);

      if (salesRes.error) throw salesRes.error;
      if (servicesRes.error) throw servicesRes.error;

      setSales(salesRes.data || []);
      setServices(servicesRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const mySales = sales.filter(s => s.seller_id === currentUser.id);
  const myServices = services;

  const salesTotal = mySales.reduce((s, sale) => s + sale.total, 0);
  const servicesTotal = myServices.reduce((s, svc) => s + svc.amount, 0);
  const grandTotal = salesTotal + servicesTotal;

  const amountCollected = mySales.reduce((s, sale) => s + sale.amount_paid, 0);
  const pendingPayments = mySales.reduce((s, sale) => {
    const remaining = sale.total - sale.amount_paid;
    return s + (remaining > 0 ? remaining : 0);
  }, 0);

  const paidCount = mySales.filter(s => s.payment_status === 'paid').length;
  const advanceCount = mySales.filter(s => s.payment_status === 'advance').length;
  const unpaidCount = mySales.filter(s => s.payment_status === 'unpaid').length;

  const pendingPrint = mySales.filter(s => s.print_status === 'pending').length;
  const printedCount = mySales.filter(s => s.print_status === 'printed').length;
  const reprintCount = mySales.filter(s => s.print_status === 'reprint_requested').length;

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  function exportRecap() {
    const lines: string[] = [];
    lines.push(`RECAPITULATIF JOURNALIER - ${isToday ? "Aujourd'hui" : formatDateLong(selectedDate)}`);
    lines.push(`Vendeur: ${currentUser.full_name || currentUser.email}`);
    lines.push('');
    lines.push('=== VENTES ===');
    lines.push(`Nombre de ventes: ${mySales.length}`);
    lines.push(`Total ventes: ${formatCurrency(salesTotal)}`);
    lines.push(`Montant encaisse: ${formatCurrency(amountCollected)}`);
    lines.push(`Reste a encaisser: ${formatCurrency(pendingPayments)}`);
    lines.push('');
    mySales.forEach(s => {
      lines.push(`  N${s.invoice_number} - ${s.client_name} - ${formatCurrency(s.total)} (${s.payment_status})`);
    });
    lines.push('');
    lines.push('=== PRESTATIONS ===');
    lines.push(`Nombre de prestations: ${myServices.length}`);
    lines.push(`Total prestations: ${formatCurrency(servicesTotal)}`);
    lines.push('');
    myServices.forEach(svc => {
      lines.push(`  ${svc.name} - ${svc.client_name || 'N/A'} - ${formatCurrency(svc.amount)}`);
    });
    lines.push('');
    lines.push(`=== TOTAL GENERAL: ${formatCurrency(grandTotal)} ===`);

    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `recap_${selectedDate}_${currentUser.full_name || currentUser.email}.txt`;
    a.click();
  }

  function formatDateLong(date: string): string {
    return new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Recapitulatif de la Journee</h2>
              <p className="text-sm text-slate-400 capitalize">
                {isToday ? "Aujourd'hui" : formatDateLong(selectedDate)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={exportRecap}
              disabled={mySales.length === 0 && myServices.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Exporter
            </button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-xs text-slate-400 font-medium">Ventes</span>
          </div>
          <p className="text-2xl font-bold text-white">{mySales.length}</p>
          <p className="text-sm text-blue-400 font-medium">{formatCurrency(salesTotal)}</p>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-cyan-600/20 rounded-lg flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="text-xs text-slate-400 font-medium">Prestations</span>
          </div>
          <p className="text-2xl font-bold text-white">{myServices.length}</p>
          <p className="text-sm text-cyan-400 font-medium">{formatCurrency(servicesTotal)}</p>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-green-600/20 rounded-lg flex items-center justify-center">
              <Wallet className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-xs text-slate-400 font-medium">Encaisse</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(amountCollected)}</p>
          <p className="text-sm text-slate-400">Recettes du jour</p>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-orange-600/20 rounded-lg flex items-center justify-center">
              <Receipt className="w-4 h-4 text-orange-400" />
            </div>
            <span className="text-xs text-slate-400 font-medium">En attente</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(pendingPayments)}</p>
          <p className="text-sm text-slate-400">Reste a percevoir</p>
        </div>
      </div>

      {/* Grand total banner */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-white" />
          <div>
            <p className="text-sm text-blue-100">Total general de la journee</p>
            <p className="text-3xl font-bold text-white">{formatCurrency(grandTotal)}</p>
          </div>
        </div>
        <div className="hidden sm:block text-right">
          <p className="text-sm text-blue-100">Ventes + Prestations</p>
        </div>
      </div>

      {/* Payment & Print status */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Payment breakdown */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-green-400" />
            Reglements
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                Payees
              </span>
              <span className="text-sm font-bold text-green-400">{paidCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-400" />
                Acompte
              </span>
              <span className="text-sm font-bold text-yellow-400">{advanceCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-red-400" />
                Non payees
              </span>
              <span className="text-sm font-bold text-red-400">{unpaidCount}</span>
            </div>
          </div>
        </div>

        {/* Print status */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Printer className="w-4 h-4 text-cyan-400" />
            Statut impression
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                En attente
              </span>
              <span className="text-sm font-bold text-cyan-400">{pendingPrint}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                Imprimees
              </span>
              <span className="text-sm font-bold text-green-400">{printedCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300 flex items-center gap-2">
                <Printer className="w-4 h-4 text-orange-400" />
                Reimpression
              </span>
              <span className="text-sm font-bold text-orange-400">{reprintCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sales detail */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-blue-400" />
            Ventes du jour ({mySales.length})
          </h3>
        </div>
        {mySales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <ShoppingCart className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucune vente enregistree ce jour</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {mySales.map(sale => {
              const remaining = sale.total - sale.amount_paid;
              return (
                <div key={sale.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {sale.client_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      N° {sale.invoice_number} ·{' '}
                      {new Date(sale.created_at).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-green-400">{formatCurrency(sale.total)}</p>
                    {remaining > 0 ? (
                      <p className="text-xs text-orange-400">Reste {formatCurrency(remaining)}</p>
                    ) : (
                      <p className="text-xs text-green-400">Payee</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Services detail */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-cyan-400" />
            Prestations du jour ({myServices.length})
          </h3>
        </div>
        {myServices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Briefcase className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucune prestation enregistree ce jour</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {myServices.map(svc => (
              <div key={svc.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{svc.name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {svc.client_name || 'Sans client'}
                    {svc.description && ` · ${svc.description}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-cyan-400">{formatCurrency(svc.amount)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
