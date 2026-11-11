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
  ChevronDown,
  Layers,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Sale, SaleItem } from '../types';
import { formatCurrency } from '../lib/utils';

function formatTime(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

interface GroupedItem {
  articleName: string;
  orders: OrderEntry[];
}

interface OrderEntry {
  saleId: string;
  clientName: string;
  time: string;
  quantity: number;
  surface: number;
  pricingType: string;
  saleTotal: number;
  isPrinted: boolean;
  printedAt: string | null;
}

function buildGroups(sales: Sale[]): GroupedItem[] {
  const map = new Map<string, OrderEntry[]>();
  for (const sale of sales) {
    const items = sale.sale_items ?? [];
    const entries: { articleName: string; quantity: number; surface: number; pricingType: string }[] = [];

    if (items.length > 0) {
      for (const item of items) {
        entries.push({
          articleName: item.article_name,
          quantity: item.quantity,
          surface: Number(item.surface),
          pricingType: item.pricing_type,
        });
      }
    } else {
      entries.push({
        articleName: sale.article_name,
        quantity: sale.quantity,
        surface: Number(sale.surface),
        pricingType: sale.pricing_type,
      });
    }

    for (const e of entries) {
      const list = map.get(e.articleName) ?? [];
      list.push({
        saleId: sale.id,
        clientName: sale.client_name,
        time: sale.created_at,
        quantity: e.quantity,
        surface: e.surface,
        pricingType: e.pricingType,
        saleTotal: sale.total,
        isPrinted: sale.print_status === 'printed',
        printedAt: sale.printed_at,
      });
      map.set(e.articleName, list);
    }
  }

  const groups: GroupedItem[] = [];
  for (const [articleName, orders] of map.entries()) {
    orders.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    groups.push({ articleName, orders });
  }
  groups.sort((a, b) => {
    const aPending = a.orders.filter(o => !o.isPrinted).length;
    const bPending = b.orders.filter(o => !o.isPrinted).length;
    if (aPending !== bPending) return bPending - aPending;
    return a.articleName.localeCompare(b.articleName);
  });
  return groups;
}

export function PrintQueue() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'printed' | 'all'>('pending');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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

  function toggleGroup(name: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const groups = buildGroups(sales);
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
                  {pendingCount} en attente · {printedCount} imprime(s) · {groups.length} article(s)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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

      {/* Print orders list grouped by article */}
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
        <div className="space-y-3">
          {groups.map((group) => {
            const groupPending = group.orders.filter(o => !o.isPrinted).length;
            const groupPrinted = group.orders.filter(o => o.isPrinted).length;
            const totalQty = group.orders.reduce((s, o) => s + o.quantity, 0);
            const isCollapsed = collapsed.has(group.articleName);

            return (
              <div
                key={group.articleName}
                className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden"
              >
                {/* Article group header */}
                <button
                  onClick={() => toggleGroup(group.articleName)}
                  className="w-full flex items-center justify-between px-5 py-4 bg-slate-700/40 hover:bg-slate-700/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      groupPending > 0 ? 'bg-cyan-600/20' : 'bg-green-600/20'
                    }`}>
                      <PackageOpen className={`w-4 h-4 ${
                        groupPending > 0 ? 'text-cyan-400' : 'text-green-400'
                      }`} />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-bold text-white">{group.articleName}</h3>
                      <p className="text-xs text-slate-400">
                        {group.orders.length} commande(s) · {totalQty} unite(s)
                        {groupPending > 0 && <span className="text-cyan-400"> · {groupPending} en attente</span>}
                        {groupPrinted > 0 && <span className="text-green-400"> · {groupPrinted} imprime(s)</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {groupPending > 0 && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-600/20 text-cyan-400 border border-cyan-600/30">
                        {groupPending} a imprimer
                      </span>
                    )}
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                  </div>
                </button>

                {/* Orders tiles under this article */}
                {!isCollapsed && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
                    {group.orders.map((order, idx) => {
                      const isPrinted = order.isPrinted;
                      return (
                        <div
                          key={`${order.saleId}-${idx}`}
                          className={`rounded-xl border p-4 flex flex-col gap-3 transition-all ${
                            isPrinted
                              ? 'bg-slate-800/60 border-green-700/30 opacity-70'
                              : 'bg-slate-700/40 border-cyan-700/40 hover:border-cyan-600/60 shadow-lg shadow-cyan-950/20'
                          }`}
                        >
                          {/* Top row: time + status */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Clock className={`w-3.5 h-3.5 ${isPrinted ? 'text-green-500' : 'text-cyan-400'}`} />
                              <span className="text-sm font-bold text-white">
                                {formatTime(order.time)}
                              </span>
                            </div>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                              isPrinted
                                ? 'bg-green-600/20 text-green-400'
                                : 'bg-cyan-600/20 text-cyan-400 animate-pulse'
                            }`}>
                              {isPrinted ? 'IMPRIME' : 'EN ATTENTE'}
                            </span>
                          </div>

                          {/* Client name */}
                          <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Client</p>
                            <p className="text-sm font-bold text-white truncate">{order.clientName}</p>
                          </div>

                          {/* Qty / surface */}
                          <div className="flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-sm text-slate-300">
                              {order.pricingType === 'format'
                                ? `${order.quantity}x`
                                : `${order.quantity}x · ${order.surface}m²`}
                            </span>
                          </div>

                          {/* Total */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-700/50">
                            <span className="text-xs text-slate-400">Total</span>
                            <span className="text-sm font-bold text-green-400">
                              {formatCurrency(order.saleTotal)}
                            </span>
                          </div>

                          {/* Printed timestamp */}
                          {isPrinted && order.printedAt && (
                            <div className="flex items-center gap-1.5 text-xs text-green-400/80">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Imprime a {formatTime(order.printedAt)}
                            </div>
                          )}

                          {/* Action button */}
                          {isPrinted ? (
                            <button
                              onClick={() => markAsPending(order.saleId)}
                              disabled={updatingId === order.saleId}
                              className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 rounded-lg font-medium transition-colors text-xs"
                            >
                              {updatingId === order.saleId ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <>
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Reimprimer
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => markAsPrinted(order.saleId)}
                              disabled={updatingId === order.saleId}
                              className="w-full flex items-center justify-center gap-1.5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors text-xs shadow-md shadow-green-600/20"
                            >
                              {updatingId === order.saleId ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  Valider l'impression
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
