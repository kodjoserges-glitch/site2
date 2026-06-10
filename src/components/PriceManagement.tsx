import { useState, useEffect } from 'react';
import {
  Settings,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  Tag,
  Package,
  ChevronRight,
  Ruler,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Article, Category, IsoFormat, ISO_FORMATS, PricingType } from '../types';
import { formatCurrency } from '../lib/utils';

const PALETTE = [
  '#2563eb', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#7c3aed', '#db2777', '#475569',
];

const emptyCat = { name: '', color: '#2563eb', description: '' };
const emptyArt = { name: '', pricing_type: 'sqm' as PricingType, price_per_sqm: '', price_per_unit: '', format: '' as IsoFormat | '' };

const FORMAT_LIST: IsoFormat[] = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'];

export function PriceManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  // Category modal
  const [catModal, setCatModal] = useState<'create' | 'edit' | null>(null);
  const [catForm, setCatForm] = useState(emptyCat);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [savingCat, setSavingCat] = useState(false);

  // Article modal
  const [artModal, setArtModal] = useState<'create' | 'edit' | null>(null);
  const [artForm, setArtForm] = useState(emptyArt);
  const [editingArtId, setEditingArtId] = useState<string | null>(null);
  const [savingArt, setSavingArt] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [catRes, artRes] = await Promise.all([
        supabase.from('categories').select('*').order('created_at'),
        supabase.from('articles').select('*').order('name'),
      ]);
      if (catRes.error) throw catRes.error;
      if (artRes.error) throw artRes.error;
      const cats = catRes.data || [];
      setCategories(cats);
      setArticles(artRes.data || []);
      if (!selectedCatId && cats.length > 0) setSelectedCatId(cats[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // ---- Category CRUD ----
  function openCreateCat() { setCatForm(emptyCat); setEditingCatId(null); setCatModal('create'); }
  function openEditCat(cat: Category) {
    setCatForm({ name: cat.name, color: cat.color, description: cat.description });
    setEditingCatId(cat.id);
    setCatModal('edit');
  }

  async function handleSaveCat(e: React.FormEvent) {
    e.preventDefault();
    if (!catForm.name.trim()) return;
    setSavingCat(true);
    try {
      if (editingCatId) {
        const { error } = await supabase.from('categories').update({ ...catForm, updated_at: new Date().toISOString() }).eq('id', editingCatId);
        if (error) throw error;
        setCategories(prev => prev.map(c => c.id === editingCatId ? { ...c, ...catForm } : c));
      } else {
        const { data, error } = await supabase.from('categories').insert(catForm).select().single();
        if (error) throw error;
        setCategories(prev => [...prev, data]);
        setSelectedCatId(data.id);
      }
      setCatModal(null);
    } catch (err) { console.error(err); alert('Erreur lors de la sauvegarde'); }
    finally { setSavingCat(false); }
  }

  async function handleDeleteCat(id: string) {
    const cat = categories.find(c => c.id === id);
    const count = articles.filter(a => a.category_id === id).length;
    if (!confirm(`Supprimer "${cat?.name}"${count > 0 ? ` et ses ${count} article(s)` : ''} ?`)) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      setCategories(prev => prev.filter(c => c.id !== id));
      setArticles(prev => prev.filter(a => a.category_id !== id));
      if (selectedCatId === id) setSelectedCatId(categories.filter(c => c.id !== id)[0]?.id ?? null);
    } catch (err) { console.error(err); alert('Erreur lors de la suppression'); }
  }

  // ---- Article CRUD ----
  function openCreateArt() { setArtForm(emptyArt); setEditingArtId(null); setArtModal('create'); }
  function openEditArt(art: Article) {
    setArtForm({
      name: art.name,
      pricing_type: art.pricing_type || 'sqm',
      price_per_sqm: String(art.price_per_sqm || ''),
      price_per_unit: String(art.price_per_unit || ''),
      format: art.format || '',
    });
    setEditingArtId(art.id);
    setArtModal('edit');
  }

  async function handleSaveArt(e: React.FormEvent) {
    e.preventDefault();
    const isFormat = artForm.pricing_type === 'format';
    if (!artForm.name.trim()) return;
    if (isFormat && (!artForm.format || !artForm.price_per_unit)) return;
    if (!isFormat && !artForm.price_per_sqm) return;
    setSavingArt(true);
    try {
      const payload = {
        name: artForm.name.trim(),
        pricing_type: artForm.pricing_type,
        price_per_sqm: isFormat ? 0 : parseFloat(artForm.price_per_sqm),
        price_per_unit: isFormat ? parseFloat(artForm.price_per_unit) : null,
        format: isFormat ? artForm.format : null,
      };
      if (editingArtId) {
        const { error } = await supabase.from('articles').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingArtId);
        if (error) throw error;
        setArticles(prev => prev.map(a => a.id === editingArtId ? { ...a, ...payload } : a));
      } else {
        const { data, error } = await supabase.from('articles').insert({ ...payload, category_id: selectedCatId }).select().single();
        if (error) throw error;
        setArticles(prev => [...prev, data]);
      }
      setArtModal(null);
    } catch (err) { console.error(err); alert('Erreur lors de la sauvegarde'); }
    finally { setSavingArt(false); }
  }

  async function handleDeleteArt(id: string) {
    if (!confirm('Supprimer cet article ?')) return;
    try {
      const { error } = await supabase.from('articles').delete().eq('id', id);
      if (error) throw error;
      setArticles(prev => prev.filter(a => a.id !== id));
    } catch (err) { console.error(err); alert('Erreur lors de la suppression'); }
  }

  const selectedCat = categories.find(c => c.id === selectedCatId);
  const visibleArticles = articles.filter(a => a.category_id === selectedCatId);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-600/20 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Gestion des Tarifs</h2>
              <p className="text-sm text-slate-400">{categories.length} categorie(s) · {articles.length} article(s)</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* LEFT: Categories */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Tag className="w-4 h-4" /> Categories
              </h3>
              <button onClick={openCreateCat} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                <Plus className="w-3.5 h-3.5" /> Nouvelle
              </button>
            </div>
            <div className="space-y-2">
              {categories.length === 0 && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center text-slate-400">
                  <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Aucune categorie</p>
                </div>
              )}
              {categories.map(cat => {
                const count = articles.filter(a => a.category_id === cat.id).length;
                const isSelected = selectedCatId === cat.id;
                return (
                  <div key={cat.id} onClick={() => setSelectedCatId(cat.id)}
                    className={`group relative flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-600/10 shadow-md shadow-blue-500/10' : 'border-slate-700 bg-slate-800 hover:border-slate-600'}`}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{cat.name}</p>
                      <p className="text-xs text-slate-400">{count} article(s)</p>
                    </div>
                    {isSelected && <ChevronRight className="w-4 h-4 text-blue-400 shrink-0" />}
                    <div className={`flex gap-1 shrink-0 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEditCat(cat)} className="p-1 hover:bg-slate-600 rounded text-slate-400 hover:text-white transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDeleteCat(cat.id)} className="p-1 hover:bg-red-600/20 rounded text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Articles */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4" />
                {selectedCat ? (
                  <span className="flex items-center gap-2">Articles —
                    <span className="px-2 py-0.5 rounded-full text-white text-xs font-medium" style={{ backgroundColor: selectedCat.color }}>{selectedCat.name}</span>
                  </span>
                ) : 'Articles'}
              </h3>
              {selectedCatId && (
                <button onClick={openCreateArt} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Nouvel article
                </button>
              )}
            </div>
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
              {!selectedCatId ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                  <Tag className="w-10 h-10 mb-3 opacity-40" /><p>Selectionnez une categorie</p>
                </div>
              ) : visibleArticles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                  <Package className="w-10 h-10 mb-3 opacity-40" />
                  <p className="mb-3">Aucun article dans cette categorie</p>
                  <button onClick={openCreateArt} className="text-blue-400 hover:text-blue-300 text-sm underline">Ajouter le premier article</button>
                </div>
              ) : (
                <div className="divide-y divide-slate-700">
                  {visibleArticles.map(article => {
                    const isFormat = article.pricing_type === 'format';
                    const fmt = isFormat && article.format ? ISO_FORMATS[article.format] : null;
                    return (
                      <div key={article.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-700/30 transition-colors">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${selectedCat?.color}25` }}>
                          {isFormat ? <Ruler className="w-4 h-4" style={{ color: selectedCat?.color }} /> : <Package className="w-4 h-4" style={{ color: selectedCat?.color }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white">{article.name}</p>
                          {isFormat && article.format ? (
                            <p className="text-xs text-slate-400">
                              Format {article.format} · {fmt ? `${(fmt.width * 100).toFixed(0)}×${(fmt.height * 100).toFixed(0)} cm` : ''}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400">Tarification au m²</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          {isFormat ? (
                            <>
                              <p className="font-bold text-blue-400">{formatCurrency(article.price_per_unit ?? 0)}</p>
                              <p className="text-xs text-slate-500">/ unité</p>
                            </>
                          ) : (
                            <>
                              <p className="font-bold text-green-400">{formatCurrency(article.price_per_sqm)}</p>
                              <p className="text-xs text-slate-500">/ m²</p>
                            </>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => openEditArt(article)} className="p-1.5 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-white transition-colors" title="Modifier"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteArt(article.id)} className="p-1.5 hover:bg-red-600/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Category Modal */}
      {catModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white">{catModal === 'create' ? 'Nouvelle categorie' : 'Modifier la categorie'}</h3>
              <button onClick={() => setCatModal(null)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveCat} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Nom *</label>
                <input type="text" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Impression souple" required autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Couleur</label>
                <div className="flex flex-wrap gap-2">
                  {PALETTE.map(color => (
                    <button key={color} type="button" onClick={() => setCatForm({ ...catForm, color })}
                      className={`w-8 h-8 rounded-lg transition-transform hover:scale-110 ${catForm.color === color ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-white scale-110' : ''}`}
                      style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description (optionnel)</label>
                <textarea value={catForm.description} onChange={e => setCatForm({ ...catForm, description: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={2} placeholder="Description de la categorie..." />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setCatModal(null)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">Annuler</button>
                <button type="submit" disabled={savingCat} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-medium transition-colors">
                  {savingCat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Article Modal */}
      {artModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white">{artModal === 'create' ? 'Nouvel article' : "Modifier l'article"}</h3>
              <button onClick={() => setArtModal(null)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveArt} className="p-5 space-y-5">
              {selectedCat && (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 rounded-lg">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedCat.color }} />
                  <span className="text-sm text-slate-300">{selectedCat.name}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Nom de l'article *</label>
                <input type="text" value={artForm.name} onChange={e => setArtForm({ ...artForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Impression couleur A4" required autoFocus />
              </div>

              {/* Pricing type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Mode de tarification *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['sqm', 'format'] as PricingType[]).map(type => (
                    <button key={type} type="button"
                      onClick={() => setArtForm({ ...artForm, pricing_type: type, format: '', price_per_sqm: '', price_per_unit: '' })}
                      className={`flex flex-col items-center gap-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
                        artForm.pricing_type === type
                          ? 'border-blue-500 bg-blue-600/15 text-white'
                          : 'border-slate-600 bg-slate-700/50 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      <span className="text-lg">{type === 'sqm' ? '📐' : '📄'}</span>
                      {type === 'sqm' ? 'Prix au m²' : 'Format international'}
                      <span className="text-xs text-slate-500 font-normal">
                        {type === 'sqm' ? 'Dimensions libres' : 'A0, A1, A2…A7'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* sqm pricing */}
              {artForm.pricing_type === 'sqm' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Prix par m² (FCFA) *</label>
                  <input type="number" value={artForm.price_per_sqm} onChange={e => setArtForm({ ...artForm, price_per_sqm: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="5000" step="100" min="1" required />
                </div>
              )}

              {/* format pricing */}
              {artForm.pricing_type === 'format' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Format ISO *</label>
                    <div className="grid grid-cols-4 gap-2">
                      {FORMAT_LIST.map(fmt => {
                        const dims = ISO_FORMATS[fmt];
                        return (
                          <button key={fmt} type="button"
                            onClick={() => setArtForm({ ...artForm, format: fmt })}
                            className={`flex flex-col items-center py-2.5 px-2 rounded-lg border text-center transition-all ${
                              artForm.format === fmt
                                ? 'border-blue-500 bg-blue-600/15 text-white'
                                : 'border-slate-600 bg-slate-700/50 text-slate-400 hover:border-slate-500 hover:text-white'
                            }`}
                          >
                            <span className="font-bold text-base">{fmt}</span>
                            <span className="text-xs mt-0.5 leading-tight opacity-75">
                              {(dims.width * 100).toFixed(0)}×{(dims.height * 100).toFixed(0)}cm
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Prix par unité / feuille (FCFA) *</label>
                    <input type="number" value={artForm.price_per_unit} onChange={e => setArtForm({ ...artForm, price_per_unit: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="500" step="50" min="1" required />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setArtModal(null)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">Annuler</button>
                <button type="submit" disabled={savingArt} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-medium transition-colors">
                  {savingArt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
