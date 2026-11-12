import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Package,
  Plus,
  Minus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  Search,
  ShoppingCart,
  History,
  PackagePlus,
  PackageMinus,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Boxes,
  FileText,
  Download,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  OfficeItem,
  OfficeSale,
  OfficeSaleItem,
  StockMovement,
  OfficePaymentStatus,
  UserProfile,
} from '../types';
import { formatCurrency, formatDate, formatDateShort } from '../lib/utils';
import { useRealtime } from '../lib/useRealtime';
import { sendNotification } from './NotificationBell';

type SubTab = 'stock' | 'sell' | 'history';

interface Props {
  currentUser: UserProfile;
}

const CATEGORIES = ['Papeterie', 'Consommable', 'Bureautique', 'Accessoire', 'Divers'];

const emptyForm = {
  name: '',
  sku: '',
  category: 'Papeterie',
  unit_price: '',
  cost_price: '',
  stock_quantity: '',
  min_stock: '',
  unit: 'pièce',
};

export function OfficeArticles({ currentUser }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('stock');
  const [items, setItems] = useState<OfficeItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [sales, setSales] = useState<OfficeSale[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(true);

  const canManageStock = currentUser.role === 'admin' || currentUser.role === 'manager';
  const canSell = currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'vendeur';

  const fetchAll = useCallback(async () => {
    if (!initialLoad.current) setLoading(false);
    try {
      const [itemsRes, movementsRes, salesRes] = await Promise.all([
        supabase.from('office_items').select('*').order('name'),
        supabase.from('office_stock_movements').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('office_sales').select('*').order('created_at', { ascending: false }).limit(100),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      if (movementsRes.error) throw movementsRes.error;
      if (salesRes.error) throw salesRes.error;
      setItems(itemsRes.data || []);
      setMovements(movementsRes.data || []);
      setSales(salesRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      initialLoad.current = false;
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useRealtime(['office_items', 'office_stock_movements', 'office_sales'], fetchAll);

  const activeSubTab = canManageStock ? subTab : canSell ? 'sell' : 'stock';

  const subTabs: { id: SubTab; label: string; icon: typeof Package; show: boolean }[] = [
    { id: 'stock', label: 'Stock', icon: Boxes, show: canManageStock },
    { id: 'sell', label: 'Vente', icon: ShoppingCart, show: canSell },
    { id: 'history', label: 'Historique', icon: History, show: true },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Articles Bureautique</h2>
            <p className="text-sm text-slate-400">
              {items.length} article(s) · {items.filter(i => i.stock_quantity <= i.min_stock).length} alerte(s) stock
            </p>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-2xl p-1.5">
        {subTabs.filter(t => t.show).map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => canManageStock && setSubTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
                isActive ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeSubTab === 'stock' && canManageStock && (
        <StockManager items={items} movements={movements} currentUser={currentUser} onRefresh={fetchAll} />
      )}
      {activeSubTab === 'sell' && canSell && (
        <SellManager items={items} currentUser={currentUser} onRefresh={fetchAll} />
      )}
      {activeSubTab === 'history' && (
        <SalesHistoryView sales={sales} currentUser={currentUser} />
      )}
    </div>
  );
}

// =====================================================
// STOCK MANAGER
// =====================================================

interface StockManagerProps {
  items: OfficeItem[];
  movements: StockMovement[];
  currentUser: UserProfile;
  onRefresh: () => void;
}

function StockManager({ items, movements, currentUser, onRefresh }: StockManagerProps) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [stockModalItem, setStockModalItem] = useState<OfficeItem | null>(null);
  const [stockType, setStockType] = useState<'in' | 'out' | 'adjustment'>('in');
  const [stockQty, setStockQty] = useState('');
  const [stockReason, setStockReason] = useState('');
  const [stockSaving, setStockSaving] = useState(false);

  const filtered = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.sku || '').toLowerCase().includes(search.toLowerCase());
    const matchesCat = catFilter === 'all' || item.category === catFilter;
    return matchesSearch && matchesCat;
  });

  const lowStockItems = items.filter(i => i.stock_quantity <= i.min_stock);

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setModal('create');
  }

  function openEdit(item: OfficeItem) {
    setForm({
      name: item.name,
      sku: item.sku || '',
      category: item.category,
      unit_price: String(item.unit_price),
      cost_price: String(item.cost_price),
      stock_quantity: String(item.stock_quantity),
      min_stock: String(item.min_stock),
      unit: item.unit,
    });
    setEditingId(item.id);
    setModal('edit');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const unitPrice = parseFloat(form.unit_price);
    if (isNaN(unitPrice) || unitPrice < 0) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        category: form.category,
        unit_price: unitPrice,
        cost_price: parseFloat(form.cost_price) || 0,
        stock_quantity: parseInt(form.stock_quantity) || 0,
        min_stock: parseInt(form.min_stock) || 0,
        unit: form.unit.trim() || 'pièce',
        updated_at: new Date().toISOString(),
      };
      if (editingId) {
        const { error } = await supabase.from('office_items').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('office_items').insert(payload);
        if (error) throw error;
      }
      setModal(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const item = items.find(i => i.id === id);
    if (!confirm(`Supprimer "${item?.name}" ?`)) return;
    try {
      const { error } = await supabase.from('office_items').delete().eq('id', id);
      if (error) throw error;
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la suppression');
    }
  }

  function openStockModal(item: OfficeItem, type: 'in' | 'out' | 'adjustment') {
    setStockModalItem(item);
    setStockType(type);
    setStockQty('');
    setStockReason('');
  }

  async function handleStockMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!stockModalItem) return;
    const qty = parseInt(stockQty);
    if (isNaN(qty) || qty <= 0) return;
    setStockSaving(true);
    try {
      const delta = stockType === 'out' ? -qty : stockType === 'adjustment' ? qty - stockModalItem.stock_quantity : qty;
      const newStock = Math.max(0, stockModalItem.stock_quantity + delta);
      const { error: updateErr } = await supabase
        .from('office_items')
        .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
        .eq('id', stockModalItem.id);
      if (updateErr) throw updateErr;

      const { error: moveErr } = await supabase.from('office_stock_movements').insert({
        item_id: stockModalItem.id,
        movement_type: stockType,
        quantity: delta,
        reason: stockReason.trim() || null,
        actor_id: currentUser.id,
        actor_name: currentUser.full_name || currentUser.email,
      });
      if (moveErr) throw moveErr;

      // Low stock notification
      if (newStock <= stockModalItem.min_stock && stockModalItem.min_stock > 0) {
        await sendNotification(
          'low_stock',
          'manager',
          `Stock bas: ${stockModalItem.name}`,
          `Le stock de "${stockModalItem.name}" est à ${newStock} ${stockModalItem.unit} (seuil: ${stockModalItem.min_stock})`,
          currentUser.full_name || currentUser.email,
        );
      }

      setStockModalItem(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Erreur lors du mouvement de stock');
    } finally {
      setStockSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <Boxes className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Articles</p>
              <p className="text-xl font-bold text-white">{items.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Valeur stock</p>
              <p className="text-xl font-bold text-white">
                {formatCurrency(items.reduce((s, i) => s + i.stock_quantity * i.unit_price, 0))}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600/20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Stock bas</p>
              <p className="text-xl font-bold text-white">{lowStockItems.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-600/20 rounded-lg flex items-center justify-center">
              <PackagePlus className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Mouvements</p>
              <p className="text-xl font-bold text-white">{movements.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Low stock alerts */}
      {lowStockItems.length > 0 && (
        <div className="bg-orange-600/10 border border-orange-600/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-semibold text-orange-400">Alertes stock bas</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.map(item => (
              <button
                key={item.id}
                onClick={() => openStockModal(item, 'in')}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
              >
                <span className="text-white">{item.name}</span>
                <span className="text-orange-400 font-medium">{item.stock_quantity} / {item.min_stock}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search + filter + add */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un article..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          className="px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">Toutes catégories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Nouvel article
        </button>
      </div>

      {/* Items table */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Package className="w-10 h-10 mb-3 opacity-40" />
            <p>Aucun article trouvé</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {filtered.map(item => {
              const isLow = item.stock_quantity <= item.min_stock;
              return (
                <div key={item.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-700/30 transition-colors">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isLow ? 'bg-orange-600/20' : 'bg-slate-600/30'}`}>
                    <Package className={`w-4 h-4 ${isLow ? 'text-orange-400' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white truncate">{item.name}</p>
                      {item.sku && <span className="text-xs text-slate-500 font-mono">{item.sku}</span>}
                    </div>
                    <p className="text-xs text-slate-400">{item.category} · {item.unit}</p>
                  </div>
                  <div className="text-center shrink-0 hidden sm:block">
                    <p className={`font-bold ${isLow ? 'text-orange-400' : 'text-white'}`}>{item.stock_quantity}</p>
                    <p className="text-xs text-slate-500">en stock</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-blue-400">{formatCurrency(item.unit_price)}</p>
                    <p className="text-xs text-slate-500">/ {item.unit}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => openStockModal(item, 'in')}
                      className="p-1.5 hover:bg-green-600/20 rounded-lg text-slate-400 hover:text-green-400 transition-colors"
                      title="Entrée stock"
                    >
                      <PackagePlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openStockModal(item, 'out')}
                      className="p-1.5 hover:bg-red-600/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                      title="Sortie stock"
                    >
                      <PackageMinus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEdit(item)}
                      className="p-1.5 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-white transition-colors"
                      title="Modifier"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 hover:bg-red-600/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent movements */}
      {movements.length > 0 && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-300">Mouvements récents</h3>
          </div>
          <div className="divide-y divide-slate-700/50 max-h-64 overflow-y-auto">
            {movements.slice(0, 20).map(m => {
              const item = items.find(i => i.id === m.item_id);
              const isIn = m.movement_type === 'in' || (m.movement_type === 'adjustment' && m.quantity > 0);
              return (
                <div key={m.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isIn ? 'bg-green-600/20' : 'bg-red-600/20'}`}>
                    {isIn ? <PackagePlus className="w-3.5 h-3.5 text-green-400" /> : <PackageMinus className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-white font-medium">{item?.name || 'Article supprimé'}</span>
                    <span className="text-slate-400 ml-2">{m.movement_type === 'adjustment' ? 'Ajustement' : m.movement_type === 'in' ? 'Entrée' : 'Sortie'} de {Math.abs(m.quantity)}</span>
                    {m.reason && <span className="text-slate-500 ml-2">— {m.reason}</span>}
                  </div>
                  <span className="text-xs text-slate-500 shrink-0">{formatDateShort(m.created_at)}</span>
                  {m.actor_name && <span className="text-xs text-slate-500 shrink-0 hidden sm:block">par {m.actor_name}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Item modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white">{modal === 'create' ? 'Nouvel article' : 'Modifier article'}</h3>
              <button onClick={() => setModal(null)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Nom *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Ramette A4 80g" required autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Référence (SKU)</label>
                  <input type="text" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: RAM-A4" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Catégorie</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Prix vente (FCFA) *</label>
                  <input type="number" min="0" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="3000" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Prix achat (FCFA)</label>
                  <input type="number" min="0" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="2000" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Stock initial</label>
                  <input type="number" min="0" value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0" disabled={modal === 'edit'} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Stock min</label>
                  <input type="number" min="0" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="5" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Unité</label>
                  <input type="text" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="pièce" />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModal(null)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">Annuler</button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-medium transition-colors">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock movement modal */}
      {stockModalItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white">
                {stockType === 'in' ? 'Entrée de stock' : stockType === 'out' ? 'Sortie de stock' : 'Ajustement'}
              </h3>
              <button onClick={() => setStockModalItem(null)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleStockMovement} className="p-5 space-y-4">
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-white font-medium">{stockModalItem.name}</p>
                <p className="text-sm text-slate-400">Stock actuel: {stockModalItem.stock_quantity} {stockModalItem.unit}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  {stockType === 'adjustment' ? 'Nouveau stock' : 'Quantité'} *
                </label>
                <input type="number" min="0" value={stockQty} onChange={e => setStockQty(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0" required autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Raison (optionnel)</label>
                <input type="text" value={stockReason} onChange={e => setStockReason(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={stockType === 'in' ? 'Achat, réapprovisionnement...' : stockType === 'out' ? 'Perte, casse...' : 'Inventaire...'} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setStockModalItem(null)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">Annuler</button>
                <button type="submit" disabled={stockSaving} className={`flex-1 flex items-center justify-center gap-2 text-white px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                  stockType === 'in' ? 'bg-green-600 hover:bg-green-700' : stockType === 'out' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}>
                  {stockSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Confirmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// SELL MANAGER
// =====================================================

interface SellManagerProps {
  items: OfficeItem[];
  currentUser: UserProfile;
  onRefresh: () => void;
}

function SellManager({ items, currentUser, onRefresh }: SellManagerProps) {
  const [cart, setCart] = useState<OfficeSaleItem[]>([]);
  const [search, setSearch] = useState('');
  const [clientName, setClientName] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<OfficePaymentStatus>('paid');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSale, setLastSale] = useState<OfficeSale | null>(null);

  const availableItems = items.filter(i => i.is_active && i.stock_quantity > 0);
  const filtered = availableItems.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    (item.sku || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalAmount = cart.reduce((s, i) => s + i.subtotal, 0);
  const totalPaid = paymentStatus === 'paid' ? totalAmount : paymentStatus === 'advance' ? (parseFloat(amountPaid) || 0) : 0;

  function addToCart(item: OfficeItem) {
    const existing = cart.find(c => c.item_id === item.id);
    if (existing) {
      if (existing.quantity >= item.stock_quantity) return;
      setCart(prev => prev.map(c =>
        c.item_id === item.id
          ? { ...c, quantity: c.quantity + 1, subtotal: (c.quantity + 1) * c.unit_price }
          : c
      ));
    } else {
      setCart(prev => [...prev, {
        item_id: item.id,
        name: item.name,
        quantity: 1,
        unit_price: item.unit_price,
        subtotal: item.unit_price,
      }]);
    }
  }

  function updateQty(itemId: string, delta: number) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    setCart(prev => prev.map(c => {
      if (c.item_id !== itemId) return c;
      const newQty = c.quantity + delta;
      if (newQty <= 0) return c;
      if (newQty > item.stock_quantity) return c;
      return { ...c, quantity: newQty, subtotal: newQty * c.unit_price };
    }));
  }

  function setQty(itemId: string, qty: number) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const clamped = Math.max(1, Math.min(qty, item.stock_quantity));
    setCart(prev => prev.map(c =>
      c.item_id === itemId ? { ...c, quantity: clamped, subtotal: clamped * c.unit_price } : c
    ));
  }

  function removeFromCart(itemId: string) {
    setCart(prev => prev.filter(c => c.item_id !== itemId));
  }

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (cart.length === 0) return;
    if (!clientName.trim()) return;
    if (paymentStatus === 'advance' && (!amountPaid || parseFloat(amountPaid) <= 0)) return;
    setSaving(true);
    try {
      const invoiceNumber = `ART-${Date.now().toString().slice(-8)}`;
      const salePayload = {
        invoice_number: invoiceNumber,
        client_name: clientName.trim(),
        total_amount: totalAmount,
        amount_paid: totalPaid,
        payment_status: paymentStatus,
        seller_id: currentUser.id,
        seller_name: currentUser.full_name || currentUser.email,
        items_json: cart,
        notes: notes.trim() || null,
      };
      const { data, error } = await supabase.from('office_sales').insert(salePayload).select().single();
      if (error) throw error;

      // Decrement stock for each item
      for (const item of cart) {
        const officeItem = items.find(i => i.id === item.item_id);
        if (!officeItem) continue;
        const newStock = Math.max(0, officeItem.stock_quantity - item.quantity);
        await supabase
          .from('office_items')
          .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
          .eq('id', item.item_id);
        await supabase.from('office_stock_movements').insert({
          item_id: item.item_id,
          movement_type: 'out',
          quantity: -item.quantity,
          reason: `Vente ${invoiceNumber}`,
          actor_id: currentUser.id,
          actor_name: currentUser.full_name || currentUser.email,
        });

        // Low stock notification
        if (newStock <= officeItem.min_stock && officeItem.min_stock > 0) {
          await sendNotification(
            'low_stock',
            'manager',
            `Stock bas: ${officeItem.name}`,
            `Le stock de "${officeItem.name}" est à ${newStock} ${officeItem.unit} (seuil: ${officeItem.min_stock})`,
            currentUser.full_name || currentUser.email,
          );
        }
      }

      // Notify managers of new office sale
      await sendNotification(
        'office_sale',
        'manager',
        'Vente article bureautique',
        `${clientName} — ${formatCurrency(totalAmount)} par ${currentUser.full_name || currentUser.email}`,
        currentUser.full_name || currentUser.email,
        data.id,
      );

      setLastSale(data);
      setCart([]);
      setClientName('');
      setAmountPaid('');
      setPaymentStatus('paid');
      setNotes('');
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la vente');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Left: Items to add */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un article..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden max-h-[60vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <Package className="w-10 h-10 mb-3 opacity-40" />
              <p>Aucun article disponible</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {filtered.map(item => {
                const inCart = cart.find(c => c.item_id === item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-700/30 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-slate-600/30">
                      <Package className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{item.name}</p>
                      <p className="text-xs text-slate-400">{item.category} · {item.stock_quantity} en stock</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-blue-400">{formatCurrency(item.unit_price)}</p>
                      {inCart && <p className="text-xs text-green-400">{inCart.quantity} dans le panier</p>}
                    </div>
                    <Plus className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart + checkout */}
      <div className="space-y-4">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Panier ({cart.length})</h3>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="ml-auto text-xs text-red-400 hover:text-red-300">Vider</button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <ShoppingCart className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Panier vide</p>
              <p className="text-xs text-slate-500">Cliquez sur un article pour l'ajouter</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-700/50 max-h-48 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.item_id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.name}</p>
                      <p className="text-xs text-slate-400">{formatCurrency(item.unit_price)} / unité</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => updateQty(item.item_id, -1)} className="w-7 h-7 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={e => setQty(item.item_id, parseInt(e.target.value) || 1)}
                        className="w-12 text-center bg-slate-700 border border-slate-600 rounded-lg text-white text-sm py-1"
                      />
                      <button onClick={() => updateQty(item.item_id, 1)} className="w-7 h-7 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-right shrink-0 w-24">
                      <p className="text-sm font-bold text-white">{formatCurrency(item.subtotal)}</p>
                    </div>
                    <button onClick={() => removeFromCart(item.item_id)} className="p-1 text-slate-500 hover:text-red-400 transition-colors shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-slate-700 bg-slate-800/50">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Total</span>
                  <span className="text-2xl font-bold text-blue-400">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Checkout form */}
        {cart.length > 0 && (
          <form onSubmit={handleCheckout} className="bg-slate-800 rounded-2xl border border-slate-700 p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Client *</label>
              <input type="text" value={clientName} onChange={e => setClientName(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nom du client" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Statut paiement</label>
              <div className="flex gap-2">
                {(['paid', 'advance', 'unpaid'] as OfficePaymentStatus[]).map(status => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setPaymentStatus(status)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      paymentStatus === status
                        ? status === 'paid' ? 'bg-green-600 text-white' : status === 'advance' ? 'bg-orange-600 text-white' : 'bg-red-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {status === 'paid' ? 'Payé' : status === 'advance' ? 'Avance' : 'Non payé'}
                  </button>
                ))}
              </div>
            </div>
            {paymentStatus === 'advance' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Montant versé (FCFA) *</label>
                <input type="number" min="0" max={totalAmount} value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0" required />
                {parseFloat(amountPaid) > 0 && (
                  <p className="text-xs text-slate-400 mt-1">Reste: {formatCurrency(totalAmount - (parseFloat(amountPaid) || 0))}</p>
                )}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes (optionnel)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={2} placeholder="Notes sur la vente..." />
            </div>
            <button type="submit" disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
              Valider la vente — {formatCurrency(totalAmount)}
            </button>
          </form>
        )}

        {/* Last sale confirmation */}
        {lastSale && (
          <div className="bg-green-600/10 border border-green-600/30 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-400">Vente enregistrée</p>
              <p className="text-xs text-slate-400">Facture {lastSale.invoice_number} — {formatCurrency(lastSale.total_amount)}</p>
            </div>
            <button onClick={() => setLastSale(null)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================
// SALES HISTORY VIEW
// =====================================================

interface SalesHistoryProps {
  sales: OfficeSale[];
  currentUser: UserProfile;
}

function SalesHistoryView({ sales, currentUser }: SalesHistoryProps) {
  const canViewAll = currentUser.role === 'admin' || currentUser.role === 'manager';
  const visibleSales = canViewAll ? sales : sales.filter(s => s.seller_id === currentUser.id);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalRevenue = visibleSales.reduce((s, v) => s + v.total_amount, 0);
  const totalPaid = visibleSales.reduce((s, v) => s + v.amount_paid, 0);

  function exportCSV() {
    const headers = ['Date', 'Facture', 'Client', 'Articles', 'Total', 'Payé', 'Reste', 'Statut', 'Vendeur'];
    const rows = visibleSales.map(s => [
      formatDate(s.created_at),
      s.invoice_number,
      s.client_name,
      (s.items_json || []).map(i => `${i.name} x${i.quantity}`).join(', '),
      s.total_amount,
      s.amount_paid,
      s.total_amount - s.amount_paid,
      s.payment_status === 'paid' ? 'Payé' : s.payment_status === 'advance' ? 'Avance' : 'Non payé',
      s.seller_name || '',
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ventes_articles_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Total ventes</p>
              <p className="text-xl font-bold text-white">{visibleSales.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Chiffre d'affaires</p>
              <p className="text-xl font-bold text-white">{formatCurrency(totalRevenue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Montant encaissé</p>
              <p className="text-xl font-bold text-white">{formatCurrency(totalPaid)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Export */}
      {visibleSales.length > 0 && (
        <div className="flex justify-end">
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors">
            <Download className="w-4 h-4" /> Exporter CSV
          </button>
        </div>
      )}

      {/* Sales list */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        {visibleSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <History className="w-10 h-10 mb-3 opacity-40" />
            <p>Aucune vente d'articles</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {visibleSales.map(sale => {
              const isExpanded = expandedId === sale.id;
              const remaining = sale.total_amount - sale.amount_paid;
              return (
                <div key={sale.id}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : sale.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-700/30 transition-colors text-left"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      sale.payment_status === 'paid' ? 'bg-green-600/20' : sale.payment_status === 'advance' ? 'bg-orange-600/20' : 'bg-red-600/20'
                    }`}>
                      <FileText className={`w-4 h-4 ${
                        sale.payment_status === 'paid' ? 'text-green-400' : sale.payment_status === 'advance' ? 'text-orange-400' : 'text-red-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white truncate">{sale.client_name}</p>
                        <span className="text-xs text-slate-500 font-mono">{sale.invoice_number}</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {formatDateShort(sale.created_at)} · {(sale.items_json || []).length} article(s)
                        {sale.seller_name && ` · ${sale.seller_name}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-white">{formatCurrency(sale.total_amount)}</p>
                      <p className={`text-xs ${sale.payment_status === 'paid' ? 'text-green-400' : sale.payment_status === 'advance' ? 'text-orange-400' : 'text-red-400'}`}>
                        {sale.payment_status === 'paid' ? 'Payé' : sale.payment_status === 'advance' ? `Avance (${formatCurrency(remaining)} restant)` : 'Non payé'}
                      </p>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-5 py-3 bg-slate-900/50 border-t border-slate-700/50">
                      <div className="space-y-2">
                        {(sale.items_json || []).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-slate-300">{item.name} <span className="text-slate-500">x{item.quantity}</span></span>
                            <span className="text-white">{formatCurrency(item.subtotal)}</span>
                          </div>
                        ))}
                        {sale.notes && (
                          <div className="pt-2 border-t border-slate-700/50 text-xs text-slate-400">
                            Notes: {sale.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
