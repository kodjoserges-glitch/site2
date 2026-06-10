import { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, Loader2, Briefcase, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Service } from '../types';
import { formatCurrency, formatDateShort } from '../lib/utils';

interface PeriodRange { start: Date; end: Date; }

interface Props {
  services: Service[];
  range: PeriodRange;
  onUpdate: () => void;
}

const emptyForm = { name: '', description: '', amount: '', service_date: new Date().toISOString().split('T')[0], client_name: '', notes: '' };

export function ComptaPrestations({ services, range, onUpdate }: Props) {
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const total = services.reduce((s, v) => s + v.amount, 0);

  function openCreate() { setForm(emptyForm); setEditingId(null); setModal('create'); }
  function openEdit(svc: Service) {
    setForm({ name: svc.name, description: svc.description, amount: String(svc.amount), service_date: svc.service_date, client_name: svc.client_name, notes: svc.notes });
    setEditingId(svc.id);
    setModal('edit');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.amount) return;
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), description: form.description, amount: parseFloat(form.amount), service_date: form.service_date, client_name: form.client_name.trim(), notes: form.notes };
      if (editingId) {
        const { error } = await supabase.from('services').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('services').insert(payload);
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
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
      onUpdate();
    } catch (err) { console.error(err); alert('Erreur lors de la suppression'); }
  }

  function exportCSV() {
    const rows = services.map(s => [formatDateShort(s.service_date), s.name, s.client_name, s.description, s.amount, s.notes]);
    const csv = [['Date','Prestation','Client','Description','Montant','Notes'].join(';'), ...rows.map(r => r.map(c => `"${c}"`).join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `prestations_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }

  return (
    <>
      <div className="space-y-4">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-cyan-600/20 rounded-lg flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="font-semibold text-white">{services.length} prestation(s)</p>
                <p className="text-sm text-slate-400">Total : <span className="font-bold text-cyan-400">{formatCurrency(total)}</span></p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={exportCSV} disabled={services.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 rounded-lg text-sm transition-colors">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={openCreate}
                className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" /> Ajouter
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          {services.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Briefcase className="w-12 h-12 mb-3 opacity-30" />
              <p className="mb-3">Aucune prestation sur cette période</p>
              <button onClick={openCreate} className="text-cyan-400 hover:text-cyan-300 text-sm underline">Ajouter la première prestation</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    {['Date','Prestation','Client','Montant','Notes','Actions'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {services.map(svc => (
                    <tr key={svc.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 px-4 text-sm text-slate-300 whitespace-nowrap">{formatDateShort(svc.service_date)}</td>
                      <td className="py-3 px-4">
                        <p className="text-sm font-medium text-white">{svc.name}</p>
                        {svc.description && <p className="text-xs text-slate-500 mt-0.5">{svc.description}</p>}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-300">{svc.client_name || '—'}</td>
                      <td className="py-3 px-4 text-sm font-bold text-cyan-400 whitespace-nowrap">{formatCurrency(svc.amount)}</td>
                      <td className="py-3 px-4 text-sm text-slate-400 max-w-48 truncate">{svc.notes || '—'}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(svc)} className="p-1.5 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-white transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(svc.id, svc.name)} className="p-1.5 hover:bg-red-600/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-700/30">
                  <tr>
                    <td colSpan={3} className="py-3 px-4 text-sm font-semibold text-slate-300">Total prestations</td>
                    <td className="py-3 px-4 text-sm font-bold text-cyan-400">{formatCurrency(total)}</td>
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
              <h3 className="text-lg font-bold text-white">{modal === 'create' ? 'Nouvelle prestation' : 'Modifier la prestation'}</h3>
              <button onClick={() => setModal(null)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Intitule de la prestation *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Ex: Installation d'enseigne" required autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Montant (FCFA) *</label>
                  <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="0" step="100" min="0" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Date *</label>
                  <input type="date" value={form.service_date} onChange={e => setForm({ ...form, service_date: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent" required />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Client (optionnel)</label>
                  <input type="text" value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Nom du client" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                  <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Description courte" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
                  <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Notes..." />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModal(null)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">Annuler</button>
                <button type="submit" disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-medium transition-colors">
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
