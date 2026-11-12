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
  AlertCircle,
  Trash2,
  XCircle,
  Calendar,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Sale, UserRole } from '../types';
import { formatCurrency } from '../lib/utils';
import { sendNotification } from './NotificationBell';
import { useRealtime } from '../lib/useRealtime';

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
  invoiceNumber: string;
  clientName: string;
  time: string;
  quantity: number;
  surface: number;
  pricingType: string;
  saleTotal: number;
  printStatus: 'pending' | 'printed' | 'reprint_requested';
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
        invoiceNumber: sale.invoice_number,
        clientName: sale.client_name,
        time: sale.created_at,
        quantity: e.quantity,
        surface: e.surface,
        pricingType: e.pricingType,
        saleTotal: sale.total,
        printStatus: sale.print_status,
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
    const aPending = a.orders.filter(o => o.printStatus === 'pending' || o.printStatus === 'reprint_requested').length;
    const bPending = b.orders.filter(o => o.printStatus === 'pending' || o.printStatus === 'reprint_requested').length;
    if (aPending !== bPending) return bPending - aPending;
    return a.articleName.localeCompare(b.articleName);
  });
  return groups;
}

interface Props {
  userRole: UserRole;
  userName: string;
}

const PRINT_ROLES: UserRole[] = ['admin', 'manager', 'imprimeur'];
const VALIDATE_ROLES: UserRole[] = ['admin', 'manager', 'vendeur'];

export function PrintQueue({ userRole, userName }: Props) {
  const canPrint = PRINT_ROLES.includes(userRole);
  const canValidateReprint = VALIDATE_ROLES.includes(userRole);
  const canDelete = userRole === 'admin' || userRole === 'manager';
  const [sales, setSales] = useState<Sale[]>([]);
  const [counts, setCounts] = useState({ pending: 0, printed: 0, reprint_requested: 0 });
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'printed' | 'reprint_requested' | 'all'>('pending');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    setSelectedIds(new Set());
    fetchCounts();
    fetchSales();
  }, [filter, filterDate]);

  useRealtime(['sales', 'sale_items'], () => { fetchCounts(); fetchSales(); });

  // ---- Selection ----
  function toggleSelect(saleId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(saleId)) next.delete(saleId);
      else next.add(saleId);
      return next;
    });
  }

  function toggleSelectGroup(_articleName: string, saleIds: string[]) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = saleIds.every(id => next.has(id));
      if (allSelected) {
        saleIds.forEach(id => next.delete(id));
      } else {
        saleIds.forEach(id => next.add(id));
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === sales.length && sales.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sales.map(s => s.id)));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function fetchCounts() {
    try {
      const [p, pr, rp] = await Promise.all([
        supabase.from('sales').select('*', { count: 'exact', head: true }).eq('print_status', 'pending'),
        supabase.from('sales').select('*', { count: 'exact', head: true }).eq('print_status', 'printed'),
        supabase.from('sales').select('*', { count: 'exact', head: true }).eq('print_status', 'reprint_requested'),
      ]);
      setCounts({
        pending: p.count ?? 0,
        printed: pr.count ?? 0,
        reprint_requested: rp.count ?? 0,
      });
    } catch {
      // counts are non-critical
    }
  }

  async function fetchSales() {
    setLoading(true);
    try {
      const startOfDay = new Date(filterDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filterDate);
      endOfDay.setHours(23, 59, 59, 999);

      let query = supabase
        .from('sales')
        .select('*, sale_items(*)')
        .order('created_at', { ascending: false });

      if (filter === 'pending') {
        query = query.eq('print_status', 'pending');
      } else if (filter === 'printed') {
        query = query
          .eq('print_status', 'printed')
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString());
      } else if (filter === 'reprint_requested') {
        query = query
          .eq('print_status', 'reprint_requested')
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString());
      } else {
        query = query
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString());
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

  async function markAsPrinted(saleId: string, invoiceNumber: string) {
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
      const sale = sales.find(s => s.id === saleId);
      setSales(prev =>
        filter === 'pending' || filter === 'reprint_requested'
          ? prev.filter(s => s.id !== saleId)
          : prev.map(s =>
              s.id === saleId
                ? { ...s, print_status: 'printed', printed_at: new Date().toISOString() }
                : s
            )
      );
      await sendNotification(
        'print_done',
        'vendeur',
        'Impression terminee',
        `La commande N° ${invoiceNumber} a ete imprimee par ${userName}.`,
        userName,
        saleId,
        sale?.seller_id ?? undefined
      );
    } catch (err) {
      console.error('Error marking as printed:', err);
      alert('Erreur lors de la mise a jour du statut d\'impression.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function requestReprint(saleId: string, invoiceNumber: string) {
    setUpdatingId(saleId);
    try {
      const { error } = await supabase
        .from('sales')
        .update({
          print_status: 'reprint_requested',
          printed_at: null,
        })
        .eq('id', saleId);
      if (error) throw error;
      const sale = sales.find(s => s.id === saleId);
      setSales(prev =>
        filter === 'printed'
          ? prev.filter(s => s.id !== saleId)
          : prev.map(s =>
              s.id === saleId
                ? { ...s, print_status: 'reprint_requested' as const, printed_at: null }
                : s
            )
      );
      await sendNotification(
        'reprint_request',
        'vendeur',
        'Reimpression demandee',
        `L'imprimeur ${userName} demande une reimpression de la commande N° ${invoiceNumber}. Validez pour relancer l'impression.`,
        userName,
        saleId,
        sale?.seller_id ?? undefined
      );
    } catch (err) {
      console.error('Error requesting reprint:', err);
      alert('Erreur lors de la demande de reimpression.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteSale(saleId: string, invoiceNumber: string) {
    if (!window.confirm(`Supprimer définitivement la commande N° ${invoiceNumber} ?`)) return;

    setUpdatingId(saleId);
    try {
      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', saleId);
      if (error) throw error;
      setSales(prev => prev.filter(s => s.id !== saleId));
      fetchCounts();
    } catch (err) {
      console.error('Error deleting sale:', err);
      alert('Suppression impossible. Vérifiez vos droits ou réessayez.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!window.confirm(`Supprimer définitivement ${count} commande(s) sélectionnée(s) ?`)) return;

    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from('sales')
        .delete()
        .in('id', ids);
      if (error) throw error;
      setSales(prev => prev.filter(s => !selectedIds.has(s.id)));
      clearSelection();
      fetchCounts();
    } catch (err) {
      console.error('Error bulk deleting:', err);
      alert('Suppression impossible. Vérifiez vos droits ou réessayez.');
    } finally {
      setBulkDeleting(false);
    }
  }

  async function validateReprint(saleId: string, invoiceNumber: string) {
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
        filter === 'reprint_requested'
          ? prev.filter(s => s.id !== saleId)
          : prev.map(s =>
              s.id === saleId
                ? { ...s, print_status: 'pending' as const, printed_at: null }
                : s
            )
      );
      await sendNotification(
        'reprint_validated',
        'imprimeur',
        'Reimpression validee',
        `La reimpression de la commande N° ${invoiceNumber} a ete validee par ${userName}. Elle est prête a etre imprimee.`,
        userName,
        saleId
      );
    } catch (err) {
      console.error('Error validating reprint:', err);
      alert('Erreur lors de la validation de la reimpression.');
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
  const pendingCount = counts.pending;
  const printedCount = counts.printed;
  const reprintCount = counts.reprint_requested;

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
                  {pendingCount} en attente · {printedCount} imprime(s) · {reprintCount} reimpression(s) · {groups.length} article(s){filter !== 'pending' && ` · ${filterDate}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className={`pl-10 pr-4 py-2 bg-slate-700 border rounded-lg text-white focus:ring-2 focus:border-transparent transition-all ${
                    filter === 'pending'
                      ? 'border-slate-600 opacity-50 cursor-not-allowed'
                      : 'border-slate-600 focus:ring-blue-500'
                  }`}
                  disabled={filter === 'pending'}
                  title={filter === 'pending' ? 'Les commandes en attente s\'affichent tous les jours' : 'Filtrer par date'}
                />
              </div>
              <div className="flex bg-slate-700 rounded-lg p-0.5 gap-0.5 flex-wrap">
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
                  onClick={() => setFilter('reprint_requested')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all relative ${
                    filter === 'reprint_requested'
                      ? 'bg-orange-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Reimpression
                  {reprintCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center bg-orange-500 text-white text-[9px] font-bold rounded-full px-1">
                      {reprintCount}
                    </span>
                  )}
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

          {/* Bulk action bar */}
          {canDelete && sales.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-t border-slate-700 bg-slate-750/30">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium text-slate-300 transition-colors"
              >
                {selectedIds.size === sales.length && sales.length > 0 ? (
                  <>
                    <span className="w-4 h-4 flex items-center justify-center rounded bg-blue-600 text-white text-xs">✓</span>
                    Tout désélectionner
                  </>
                ) : (
                  <>
                    <span className="w-4 h-4 flex items-center justify-center rounded border-2 border-slate-500" />
                    Tout sélectionner
                  </>
                )}
              </button>
              {selectedIds.size > 0 && (
                <>
                  <button
                    onClick={bulkDelete}
                    disabled={bulkDeleting}
                    className="flex items-center gap-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors shadow-lg shadow-red-600/20"
                  >
                    {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Supprimer ({selectedIds.size})
                  </button>
                  <button
                    onClick={clearSelection}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium text-slate-400 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Annuler
                  </button>
                  <span className="text-xs text-slate-400 ml-1">{selectedIds.size} sélectionnée(s)</span>
                </>
              )}
            </div>
          )}
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
          <p>Aucune commande d'impression {filter === 'pending' ? 'en attente' : filter === 'printed' ? 'imprimee' : filter === 'reprint_requested' ? 'en reimpression' : `pour le ${filterDate}`}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const groupPending = group.orders.filter(o => o.printStatus === 'pending').length;
            const groupPrinted = group.orders.filter(o => o.printStatus === 'printed').length;
            const groupReprint = group.orders.filter(o => o.printStatus === 'reprint_requested').length;
            const totalQty = group.orders.reduce((s, o) => s + o.quantity, 0);
            const isCollapsed = collapsed.has(group.articleName);

            return (
              <div
                key={group.articleName}
                className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden"
              >
                {/* Article group header */}
                <div
                  className="w-full flex items-center justify-between px-5 py-4 bg-slate-700/40 hover:bg-slate-700/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {canDelete && (
                      <button
                        onClick={() => toggleSelectGroup(group.articleName, group.orders.map(o => o.saleId))}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0 ${
                          group.orders.every(o => selectedIds.has(o.saleId))
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : group.orders.some(o => selectedIds.has(o.saleId))
                            ? 'bg-blue-600/30 border-blue-500 text-white'
                            : 'border-slate-500 hover:border-slate-400'
                        }`}
                      >
                        {group.orders.every(o => selectedIds.has(o.saleId)) ? '✓' : group.orders.some(o => selectedIds.has(o.saleId)) ? '−' : ''}
                      </button>
                    )}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      groupReprint > 0 ? 'bg-orange-600/20' : groupPending > 0 ? 'bg-cyan-600/20' : 'bg-green-600/20'
                    }`}>
                      <PackageOpen className={`w-4 h-4 ${
                        groupReprint > 0 ? 'text-orange-400' : groupPending > 0 ? 'text-cyan-400' : 'text-green-400'
                      }`} />
                    </div>
                    <button onClick={() => toggleGroup(group.articleName)} className="text-left">
                      <h3 className="text-sm font-bold text-white">{group.articleName}</h3>
                      <p className="text-xs text-slate-400">
                        {group.orders.length} commande(s) · {totalQty} unite(s)
                        {groupPending > 0 && <span className="text-cyan-400"> · {groupPending} en attente</span>}
                        {groupPrinted > 0 && <span className="text-green-400"> · {groupPrinted} imprime(s)</span>}
                        {groupReprint > 0 && <span className="text-orange-400"> · {groupReprint} reimpression(s)</span>}
                      </p>
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    {groupReprint > 0 && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-600/20 text-orange-400 border border-orange-600/30">
                        {groupReprint} a valider
                      </span>
                    )}
                    {groupPending > 0 && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-600/20 text-cyan-400 border border-cyan-600/30">
                        {groupPending} a imprimer
                      </span>
                    )}
                    <button onClick={() => toggleGroup(group.articleName)}>
                      <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Orders list under this article */}
                {!isCollapsed && (
                  <div className="divide-y divide-slate-700/50">
                    {group.orders.map((order, idx) => {
                      const isPrinted = order.printStatus === 'printed';
                      const isReprintRequested = order.printStatus === 'reprint_requested';
                      const isPending = order.printStatus === 'pending';
                      return (
                        <div
                          key={`${order.saleId}-${idx}`}
                          className={`flex items-center gap-4 px-5 py-3 transition-all ${
                            selectedIds.has(order.saleId) ? 'bg-blue-600/10' : isReprintRequested
                              ? 'bg-orange-600/5 hover:bg-orange-600/10'
                              : isPrinted ? 'opacity-60' : 'hover:bg-slate-700/20'
                          }`}
                        >
                          {/* Checkbox */}
                          {canDelete && (
                            <button
                              onClick={() => toggleSelect(order.saleId)}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0 ${
                                selectedIds.has(order.saleId)
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'border-slate-600 hover:border-slate-400'
                              }`}
                            >
                              {selectedIds.has(order.saleId) ? '✓' : ''}
                            </button>
                          )}

                          {/* Sequential number */}
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                            isReprintRequested
                              ? 'bg-orange-600/30 text-orange-300 border border-orange-600/40'
                              : isPrinted
                              ? 'bg-slate-700 text-slate-400'
                              : 'bg-cyan-600/30 text-cyan-300 border border-cyan-600/40'
                          }`}>
                            {idx + 1}
                          </div>

                          {/* Time */}
                          <div className="flex items-center gap-1.5 w-16 shrink-0">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-sm font-medium text-slate-300">
                              {formatTime(order.time)}
                            </span>
                          </div>

                          {/* Client + invoice number */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">
                              {order.clientName}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              N° {order.invoiceNumber}
                            </p>
                          </div>

                          {/* Quantity / surface */}
                          <div className="hidden sm:flex items-center gap-2 shrink-0">
                            <Layers className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-sm text-slate-300">
                              {order.pricingType === 'format'
                                ? `${order.quantity}x`
                                : `${order.quantity}x · ${order.surface}m²`}
                            </span>
                          </div>

                          {/* Total */}
                          <div className="hidden md:block shrink-0 w-28 text-right">
                            <span className="text-sm font-medium text-green-400">
                              {formatCurrency(order.saleTotal)}
                            </span>
                          </div>

                          {/* Status badge */}
                          {isReprintRequested ? (
                            <div className="flex items-center gap-1.5 shrink-0 w-32 justify-end">
                              <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
                              <span className="text-xs text-orange-400 font-medium">
                                A revalider
                              </span>
                            </div>
                          ) : isPrinted ? (
                            <div className="flex items-center gap-1.5 shrink-0 w-32 justify-end">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                              <span className="text-xs text-green-400">
                                {order.printedAt ? formatTime(order.printedAt) : 'Imprime'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-600/20 text-cyan-400 shrink-0">
                              En attente
                            </span>
                          )}

                          {/* Action button */}
                          <div className="flex items-center gap-2 shrink-0">
                            {isReprintRequested ? (
                              canValidateReprint ? (
                                <button
                                  onClick={() => validateReprint(order.saleId, order.invoiceNumber)}
                                  disabled={updatingId === order.saleId}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors text-xs shadow-md shadow-orange-600/20"
                                >
                                  {updatingId === order.saleId ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      Valider
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span className="text-xs text-orange-400 italic px-2">
                                  En attente de validation
                                </span>
                              )
                            ) : isPrinted ? (
                              canPrint ? (
                                <button
                                  onClick={() => requestReprint(order.saleId, order.invoiceNumber)}
                                  disabled={updatingId === order.saleId}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 rounded-lg font-medium transition-colors text-xs"
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
                                <span className="text-xs text-slate-500 italic px-2">
                                  Lecture seule
                                </span>
                              )
                            ) : isPending ? (
                              canPrint ? (
                                <button
                                  onClick={() => markAsPrinted(order.saleId, order.invoiceNumber)}
                                  disabled={updatingId === order.saleId}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors text-xs shadow-md shadow-green-600/20"
                                >
                                  {updatingId === order.saleId ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      Valider
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span className="text-xs text-slate-500 italic px-2">
                                  Lecture seule
                                </span>
                              )
                            ) : null}
                            {canDelete && (
                              <button
                                onClick={() => deleteSale(order.saleId, order.invoiceNumber)}
                                disabled={updatingId === order.saleId}
                                title="Supprimer la commande"
                                aria-label={`Supprimer la commande N° ${order.invoiceNumber}`}
                                className="p-1.5 text-red-400 hover:text-white hover:bg-red-600 disabled:opacity-50 rounded-lg transition-colors"
                              >
                                {updatingId === order.saleId ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
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
          })}
        </div>
      )}
    </div>
  );
}
