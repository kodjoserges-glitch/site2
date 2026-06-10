import { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, Loader2, Receipt, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Expense, ExpenseCategory } from '../types';
import { formatCurrency, formatDateShort } from '../lib/utils';

interface PeriodRange { start: Date; end: Date; }

interface Props {
  expenses: Expense[];
  range: PeriodRange;
  onUpdate: () => void;
}

const emptyForm = { category: 'divers' as ExpenseCategory, name: '', amount: '', expense_date: new Date().toISOString().split('T')[0], supplier: '', notes: '' };

export function ComptaDepenses({ expenses, range, onUpdate }: Props) {
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | ExpenseCategory>('all');

  const filtered = filter === 'all' ? expenses : expenses.filter(e => e.category === filter);
  const totalAll = expenses.reduce((s, e) => s + e.amount, 0);
  const totalAchats = expenses.filter(e => e.category === 'achat').reduce((s, e) => s + e.amount, 0);
  const totalDivers = expenses.filter(e => e.category === 'divers').reduce((s, e) => s + e.amount, 0);

  function openCreate() { setForm(emptyForm); setEditingId(null); setModal('create'); }
  function openEdit(exp: Expense) {
    setForm({ category: exp.category, name: exp.name, amount: String(exp.amount), expense_date: exp.expense_date, supplier: exp.supplier, notes: exp.notes });
    setEditingId(exp.id);
    setModal('edit');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.amount) return;
    setSaving(true);
    try {
      const payload = { category: form.category, name: form.name.trim(), amount: parseFloat(form.amount), expense_date: form.expense_date, supplier: form.supplier.trim(), notes: form.notes };
      if (editingId) {
        const { error } = await supabase.from('expenses').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('expenses').insert(payload);
        if (error) throw error;
      }
      setModal(null);
      onUpdate();
    } catch (err) { console.error(err); alert('Erreur lors de la sauvegarde'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer "${name}" ?`)) return;
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      onUpdate();
    } catch (err) { console.error(err); alert('Erreur lors de la suppression'); }
  }

  function exportCSV() {
    const rows = expenses.map(e => [formatDateShort(e.expense_date), e.category === 'achat' ? 'Achat' : 'Divers', e.name, e.supplier, e.amount, e.notes]);
    const csv = [['Date','Categorie','Description','Fournisseur','Montant','Notes'].join(';'), ...rows.map(r => r.map(c => `"${c}"`).join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `depenses_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }

  const tabStyle = (active: boolean) => `px-4 py-2 rounded-lg text-sm font-medium transition-all ${active ? 'bg-orange-600 text-white shadow-md' : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'}`;

  return (
    <>
      <div className="space-y-4">
        {/* Summary + actions */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-orange-600/20 rounded-lg flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Total dépenses</p>
                  <p className="font-bold text-orange-400">{formatCurrency(totalAll)}</p>
                </div>
              </div>
              <div className="h-10 w-px bg-slate-700 hidden sm:block" />
              <div>
                <p className="text-xs text-slate-400">Achats</p>
                <p className="font-semibold text-blue-400">{formatCurrency(totalAchats)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Divers</p>
                <p className="font-semibold text-slate-300">{formatCurrency(totalDivers)}</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={exportCSV} disabled={expenses.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 rounded-lg text-sm transition-colors">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={openCreate}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" /> Ajouter
              </button>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          <button onClick={() => setFilter('all')} className={tabStyle(filter === 'all')}>Toutes ({expenses.length})</button>
          <button onClick={() => setFilter('achat')} className={tabStyle(filter === 'achat')}>Achats ({expenses.filter(e=>e.category==='achat').length})</button>
          <button onClick={() => setFilter('divers')} className={tabStyle(filter === 'divers')}>Divers ({expenses.filter(e=>e.category==='divers').length})</button>
        </div>

        {/* Table */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Receipt className="w-12 h-12 mb-3 opacity-30" />
              <p className="mb-3">Aucune dépense sur cette période</p>
              <button onClick={openCreate} className="text-orange-400 hover:text-orange-300 text-sm underline">Ajouter la première dépense</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    {['Date','Categorie','Description','Fournisseur','Montant','Notes','Actions'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filtered.map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 px-4 text-sm text-slate-300 whitespace-nowrap">{formatDateShort(exp.expense_date)}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${exp.category === 'achat' ? 'bg-blue-600/20 text-blue-400' : 'bg-slate-600/50 text-slate-300'}`}>
                          {exp.category === 'achat' ? 'Achat' : 'Divers'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-white">{exp.name}</td>
                      <td className="py-3 px-4 text-sm text-slate-300">{exp.supplier || '—'}</td>
                      <td className="py-3 px-4 text-sm font-bold text-orange-400 whitespace-nowrap">{formatCurrency(exp.amount)}</td>
                      <td className="py-3 px-4 text-sm text-slate-400 max-w-40 truncate">{exp.notes || '—'}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(exp)} className="p-1.5 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-white transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(exp.id, exp.name)} className="p-1.5 hover:bg-red-600/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-700/30">
                  <tr>
                    <td colSpan={4} className="py-3 px-4 text-sm font-semibold text-slate-300">
                      Total {filter === 'all' ? 'dépenses' : filter === 'achat' ? 'achats' : 'divers'}
                    </td>
                    <td className="py-3 px-4 text-sm font-bold text-orange-400">
                      {formatCurrency(filtered.reduce((s,e) => s + e.amount, 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white">{modal === 'create' ? 'Nouvelle dépense' : 'Modifier la dépense'}</h3>
              <button onClick={() => setModal(null)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Categorie *</label>
                <div className="grid grid-cols-2 gap-2">
                  {([['achat', 'Achat / Approvisionnement'], ['divers', 'Depense Diverse']] as const).map(([val, lbl]) => (
                    <button key={val} type="button" onClick={() => setForm({ ...form, category: val })}
                      className={`py-2.5 px-4 rounded-xl border-2 text-sm font-medium transition-all ${form.category === val ? 'border-orange-500 bg-orange-600/15 text-white' : 'border-slate-600 bg-slate-700/50 text-slate-400 hover:border-slate-500'}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Description *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder={form.category === 'achat' ? 'Ex: Achat papier A4 500 feuilles' : 'Ex: Frais de transport'} required autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Montant (FCFA) *</label>
                  <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="0" step="100" min="0" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Date *</label>
                  <input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent" required />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Fournisseur (optionnel)</label>
                  <input type="text" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Nom du fournisseur" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
                  <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Notes..." />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModal(null)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">Annuler</button>
                <button type="submit" disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-medium transition-colors">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
