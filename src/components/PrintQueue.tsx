import { useState, useEffect } from 'react';
import {
  Printer,
  Clock,
  CheckCircle2,
  Loader2,
  RefreshCw,
  PackageOpen,
  Check,
  RotateCcw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Sale } from '../types';
import { formatCurrency } from '../lib/utils';

function formatTime(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function PrintQueue() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'printed' | 'all'>('pending');

  useEffect(() => {
    fetchSales();
  }, [filter]);

  async function fetchSales() {
    setLoading(true);
    try {
      let query = supabase
        .from('sales')
        .select('*, sale_items(*)')
        .order('created_at', { ascending: false });

      if (filter === 'pending') {
        query = query.eq('print_status', 'pending');
      } else if (filter === 'printed') {
        query = query.eq('print_status', 'printed');
      }

      const { data, error } = await query;
      if (error) throw error;
      setSales(data || []);
    } catch (err) {
      console.error('Error fetching print queue:', err);
    } finally {
      setLoading(false);
    }
  }

  async function markAsPrinted(saleId: string) {
    setUpdatingId(saleId);
    try {
      const { error } = await supabase
        .from('sales')
        .update({
          print_status: 'printed',
          printed_at: new Date().toISOString(),
        })
        .eq('id', saleId);
      if (error) throw error;
      setSales(prev =>
        prev.map(s =>
          s.id === saleId
            ? { ...s, print_status: 'printed', printed_at: new Date().toISOString() }
            : s
        )
      );
    } catch (err) {
      console.error('Error marking as printed:', err);
      alert('Erreur lors de la mise a jour du statut d\'impression.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function markAsPending(saleId: string) {
    setUpdatingId(saleId);
    try {
      const { error } = await supabase
        .from('sales')
        .update({
          print_status: 'pending',
          printed_at: null,
        })
        .eq('id', saleId);
      if (error) throw error;
      setSales(prev =>
        prev.map(s =>
          s.id === saleId
            ? { ...s, print_status: 'pending', printed_at: null }
            : s
        )
      );
    } catch (err) {
      console.error('Error marking as pending:', err);
      alert('Erreur lors de la mise a jour du statut d\'impression.');
    } finally {
      setUpdatingId(null);
    }
  }

  const pendingCount = sales.filter(s => s.print_status === 'pending').length;
  const printedCount = sales.filter(s => s.print_status === 'printed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-600/20 rounded-lg flex items-center justify-center">
                <Printer className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">File d'Impression</h2>
                <p className="text-sm text-slate-400">
                  {pendingCount} en attente · {printedCount} imprime(s)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Filter buttons */}
              <div className="flex bg-slate-700 rounded-lg p-0.5 gap-0.5">
                <button
                  onClick={() => setFilter('pending')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    filter === 'pending'
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  En attente
                </button>
                <button
                  onClick={() => setFilter('printed')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    filter === 'printed'
                      ? 'bg-green-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Imprimees
                </button>
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    filter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Toutes
                </button>
              </div>
              <button
                onClick={fetchSales}
                className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Print orders */}
      {loading ? (
        <div className="flex items-center justify-center h-64 bg-slate-800 rounded-2xl border border-slate-700">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      ) : sales.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-slate-800 rounded-2xl border border-slate-700 text-slate-400">
          <Printer className="w-12 h-12 mb-4 opacity-50" />
          <p>Aucune commande d'impression {filter === 'pending' ? 'en attente' : filter === 'printed' ? 'imprimee' : ''}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sales.map((sale) => {
            const isPrinted = sale.print_status === 'printed';
            const items = sale.sale_items ?? [];
            return (
              <div
                key={sale.id}
                className={`bg-slate-800 rounded-2xl border overflow-hidden transition-all ${
                  isPrinted
                    ? 'border-green-700/40 opacity-75'
                    : 'border-cyan-700/40 hover:border-cyan-600/60 shadow-lg shadow-cyan-950/20'
                }`}
              >
                {/* Card header */}
                <div className={`px-4 py-3 flex items-center justify-between border-b ${
                  isPrinted
                    ? 'bg-green-600/10 border-green-700/30'
                    : 'bg-cyan-600/10 border-cyan-700/30'
                }`}>
                  <div className="flex items-center gap-2">
                    <Clock className={`w-4 h-4 ${isPrinted ? 'text-green-400' : 'text-cyan-400'}`} />
                    <span className="text-sm font-bold text-white">
                      {formatTime(sale.created_at)}
                    </span>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                    isPrinted
                      ? 'bg-green-600/20 text-green-400'
                      : 'bg-cyan-600/20 text-cyan-400 animate-pulse'
                  }`}>
                    {isPrinted ? 'IMPRIME' : 'EN ATTENTE'}
                  </span>
                </div>

                {/* Card body */}
                <div className="p-4 space-y-3">
                  {/* Client */}
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Client</p>
                    <p className="text-base font-bold text-white truncate">{sale.client_name}</p>
                  </div>

                  {/* Print types */}
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <PackageOpen className="w-3 h-3" />
                      A imprimer
                    </p>
                    {items.length > 0 ? (
                      <ul className="space-y-1">
                        {items.map((item, i) => (
                          <li
                            key={item.id ?? i}
                            className="text-sm text-slate-300 bg-slate-700/40 rounded-lg px-2.5 py-1.5 flex items-center justify-between"
                          >
                            <span className="truncate">{item.article_name}</span>
                            <span className="text-slate-400 text-xs shrink-0 ml-2">
                              {item.pricing_type === 'format'
                                ? `${item.quantity}x`
                                : `${item.quantity}x · ${item.surface}m²`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-300 bg-slate-700/40 rounded-lg px-2.5 py-1.5">
                        {sale.article_name}
                      </p>
                    )}
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                    <span className="text-xs text-slate-400">Total</span>
                    <span className="text-sm font-bold text-green-400">
                      {formatCurrency(sale.total)}
                    </span>
                  </div>

                  {/* Printed timestamp */}
                  {isPrinted && sale.printed_at && (
                    <div className="flex items-center gap-1.5 text-xs text-green-400/80">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Imprime a {formatTime(sale.printed_at)}
                    </div>
                  )}
                </div>

                {/* Card actions */}
                <div className="px-4 pb-4">
                  {isPrinted ? (
                    <button
                      onClick={() => markAsPending(sale.id)}
                      disabled={updatingId === sale.id}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 rounded-lg font-medium transition-colors text-sm"
                    >
                      {updatingId === sale.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <RotateCcw className="w-4 h-4" />
                          Reimprimer
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => markAsPrinted(sale.id)}
                      disabled={updatingId === sale.id}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors text-sm shadow-lg shadow-green-600/20"
                    >
                      {updatingId === sale.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Valider l'impression
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
