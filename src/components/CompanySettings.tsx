import { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Star,
  Loader2,
  X,
  Check,
  Phone,
  Mail,
  MapPin,
  Globe,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CompanyProfile } from '../types';
import { DriveSync } from './DriveSync';

interface Props {
  onUpdate: () => void;
}

const emptyForm = {
  company_name: '',
  slogan: '',
  logo_url: '',
  phone: '',
  email: '',
  address: '',
  website: '',
  invoice_footer: 'Merci pour votre confiance !',
  primary_color: '#2563eb',
};

type FormData = typeof emptyForm;

export function CompanySettings({ onUpdate }: Props) {
  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .order('created_at');
      if (error) throw error;
      setProfiles(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setShowModal(true);
  }

  function openEdit(p: CompanyProfile) {
    setForm({
      company_name: p.company_name,
      slogan: p.slogan || '',
      logo_url: p.logo_url || '',
      phone: p.phone || '',
      email: p.email || '',
      address: p.address || '',
      website: p.website || '',
      invoice_footer: p.invoice_footer || '',
      primary_color: p.primary_color || '#2563eb',
    });
    setEditingId(p.id);
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        logo_url: form.logo_url.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (editingId) {
        const { error } = await supabase
          .from('company_settings')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const isFirst = profiles.length === 0;
        const { error } = await supabase
          .from('company_settings')
          .insert({ ...payload, is_default: isFirst });
        if (error) throw error;
      }
      setShowModal(false);
      await fetchProfiles();
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const profile = profiles.find(p => p.id === id);
    if (!confirm(`Supprimer le profil "${profile?.company_name}" ?`)) return;
    try {
      const { error } = await supabase.from('company_settings').delete().eq('id', id);
      if (error) throw error;
      const updated = profiles.filter(p => p.id !== id);
      if (profile?.is_default && updated.length > 0) {
        await supabase.from('company_settings').update({ is_default: true }).eq('id', updated[0].id);
      }
      await fetchProfiles();
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la suppression');
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await supabase.from('company_settings').update({ is_default: false }).neq('id', id);
      await supabase.from('company_settings').update({ is_default: true }).eq('id', id);
      await fetchProfiles();
      onUpdate();
    } catch (err) {
      console.error(err);
    }
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Profils d'entreprise</h2>
              <p className="text-sm text-slate-400">{profiles.length} profil(s) configure(s)</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau profil
          </button>
        </div>
      </div>

      {/* Profile Cards */}
      {profiles.length === 0 ? (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 flex flex-col items-center justify-center h-48 text-slate-400">
          <Building2 className="w-12 h-12 mb-3 opacity-50" />
          <p>Aucun profil configure</p>
          <button
            onClick={openCreate}
            className="mt-3 text-blue-400 hover:text-blue-300 text-sm underline"
          >
            Creer le premier profil
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((p) => (
            <div
              key={p.id}
              className={`relative bg-slate-800 rounded-2xl border overflow-hidden transition-all ${
                p.is_default ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-slate-700'
              }`}
            >
              {p.is_default && (
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded-full">
                  <Star className="w-3 h-3 fill-current" />
                  Defaut
                </div>
              )}

              {/* Color bar */}
              <div
                className="h-2 w-full"
                style={{ backgroundColor: p.primary_color || '#2563eb' }}
              />

              <div className="p-5 space-y-4">
                {/* Logo / Initial */}
                <div className="flex items-center gap-3">
                  {p.logo_url ? (
                    <img
                      src={p.logo_url}
                      alt={p.company_name}
                      className="w-12 h-12 rounded-lg object-cover border border-slate-600"
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: p.primary_color || '#2563eb' }}
                    >
                      {p.company_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-white">{p.company_name}</h3>
                    {p.slogan && <p className="text-xs text-slate-400">{p.slogan}</p>}
                  </div>
                </div>

                {/* Contact info */}
                <div className="space-y-1.5 text-sm">
                  {p.phone && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{p.phone}</span>
                    </div>
                  )}
                  {p.email && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{p.email}</span>
                    </div>
                  )}
                  {p.address && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{p.address}</span>
                    </div>
                  )}
                  {p.website && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{p.website}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
                  {!p.is_default && (
                    <button
                      onClick={() => handleSetDefault(p.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-blue-600/20 hover:text-blue-400 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Star className="w-3.5 h-3.5" />
                      Definir par defaut
                    </button>
                  )}
                  <div className="ml-auto flex gap-1">
                    <button
                      onClick={() => openEdit(p)}
                      className="p-1.5 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-white transition-colors"
                      title="Modifier"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 hover:bg-red-600/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Google Drive Sync */}
      <div className="mt-8">
        <h2 className="text-base font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <span>Intégrations</span>
          <div className="flex-1 h-px bg-slate-700" />
        </h2>
        <DriveSync />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white">
                {editingId ? 'Modifier le profil' : 'Nouveau profil entreprise'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* Nom + couleur */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Nom de l'entreprise *
                  </label>
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Mon Entreprise"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Couleur
                  </label>
                  <div className="relative h-[42px]">
                    <input
                      type="color"
                      value={form.primary_color}
                      onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div
                      className="w-full h-full rounded-lg border-2 border-slate-600 flex items-center justify-center"
                      style={{ backgroundColor: form.primary_color }}
                    >
                      <span className="text-white text-xs font-mono font-bold drop-shadow">
                        {form.primary_color.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Slogan</label>
                <input
                  type="text"
                  value={form.slogan}
                  onChange={(e) => setForm({ ...form, slogan: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Votre slogan..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  URL du logo (optionnel)
                </label>
                <input
                  type="url"
                  value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://..."
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Telephone
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+225 XX XX XX XX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="contact@entreprise.com"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Adresse</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ville, Pays"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Site web</label>
                  <input
                    type="text"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="www.entreprise.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Pied de facture
                </label>
                <textarea
                  value={form.invoice_footer}
                  onChange={(e) => setForm({ ...form, invoice_footer: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={2}
                  placeholder="Merci pour votre confiance !"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {editingId ? 'Enregistrer' : 'Creer le profil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
