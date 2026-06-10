import { useState, useEffect } from 'react';
import { Calculator, ShoppingCart, Loader2, Check, Building2, Tag, Ruler } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Article, Category, Sale, PaymentStatus, DiscountType, CompanyProfile, ISO_FORMATS } from '../types';
import { formatCurrency, calculateSurface, calculateTotal } from '../lib/utils';
import { generateInvoicePDF } from '../lib/pdf';

interface Props {
  profiles: CompanyProfile[];
  defaultProfile: CompanyProfile | null;
}

export function NewSale({ profiles, defaultProfile }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  const [clientName, setClientName] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [width, setWidth] = useState('');
  const [length, setLength] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [discount, setDiscount] = useState('0');
  const [discountType, setDiscountType] = useState<DiscountType>('percentage');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid');
  const [notes, setNotes] = useState('');

  const [surface, setSurface] = useState(0);
  const [subtotal, setSubtotal] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [total, setTotal] = useState(0);
  const [remaining, setRemaining] = useState(0);

  const [lastSale, setLastSale] = useState<Sale | null>(null);

  useEffect(() => {
    if (defaultProfile && !selectedProfileId) setSelectedProfileId(defaultProfile.id);
  }, [defaultProfile]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [catRes, artRes] = await Promise.all([
        supabase.from('categories').select('*').order('created_at'),
        supabase.from('articles').select('*').order('name'),
      ]);
      if (catRes.error) throw catRes.error;
      if (artRes.error) throw artRes.error;
      const cats = catRes.data || [];
      const arts = artRes.data || [];
      setCategories(cats);
      setArticles(arts);
      if (cats.length > 0) {
        const firstCat = cats[0];
        setSelectedCategoryId(firstCat.id);
        const firstArt = arts.find(a => a.category_id === firstCat.id);
        if (firstArt) setSelectedArticleId(firstArt.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleCategoryChange(catId: string) {
    setSelectedCategoryId(catId);
    const first = articles.find(a => a.category_id === catId);
    setSelectedArticleId(first?.id ?? '');
    setWidth('');
    setLength('');
  }

  // When article changes, reset dimensions
  function handleArticleChange(artId: string) {
    setSelectedArticleId(artId);
    setWidth('');
    setLength('');
  }

  // Recalculate totals
  useEffect(() => {
    const art = articles.find(a => a.id === selectedArticleId);
    const q = parseInt(quantity) || 1;
    const d = parseFloat(discount) || 0;
    const paid = parseFloat(amountPaid) || 0;

    if (!art) {
      setSurface(0); setSubtotal(0); setDiscountAmount(0); setTotal(0); setRemaining(0);
      return;
    }

    if (art.pricing_type === 'format' && art.format) {
      const dims = ISO_FORMATS[art.format];
      const surf = Number((dims.width * dims.height).toFixed(4));
      setSurface(surf);
      const unitPrice = art.price_per_unit ?? 0;
      const sub = unitPrice * q;
      const discAmt = discountType === 'percentage' ? sub * (d / 100) : d;
      const tot = Math.max(0, sub - discAmt);
      setSubtotal(Number(sub.toFixed(2)));
      setDiscountAmount(Number(discAmt.toFixed(2)));
      setTotal(Number(tot.toFixed(2)));
      setRemaining(Math.max(0, tot - paid));
    } else {
      const w = parseFloat(width) || 0;
      const l = parseFloat(length) || 0;
      const surf = calculateSurface(w, l);
      setSurface(surf);
      if (surf > 0) {
        const result = calculateTotal(surf, art.price_per_sqm, q, d, discountType);
        setSubtotal(result.subtotal);
        setDiscountAmount(result.discountAmount);
        setTotal(result.total);
        setRemaining(Math.max(0, result.total - paid));
      } else {
        setSubtotal(0); setDiscountAmount(0); setTotal(0); setRemaining(0);
      }
    }
  }, [selectedArticleId, width, length, quantity, discount, discountType, amountPaid, articles]);

  useEffect(() => {
    if (total === 0) return;
    if (parseFloat(amountPaid) >= total) setPaymentStatus('paid');
    else if (parseFloat(amountPaid) > 0) setPaymentStatus('advance');
    else setPaymentStatus('unpaid');
  }, [amountPaid, total]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const art = articles.find(a => a.id === selectedArticleId);
    if (!clientName.trim() || !art) return;

    const isFormat = art.pricing_type === 'format';
    if (!isFormat && surface === 0) {
      alert('Veuillez saisir les dimensions');
      return;
    }
    if (isFormat && !art.format) return;

    setSaving(true);
    try {
      let saleWidth: number, saleLength: number, saleSurface: number;
      if (isFormat && art.format) {
        const dims = ISO_FORMATS[art.format];
        saleWidth = dims.width;
        saleLength = dims.height;
        saleSurface = Number((dims.width * dims.height).toFixed(4));
      } else {
        saleWidth = parseFloat(width);
        saleLength = parseFloat(length);
        saleSurface = surface;
      }

      const saleData = {
        invoice_number: `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`,
        client_name: clientName.trim(),
        article_id: art.id,
        article_name: art.name,
        width: saleWidth,
        length: saleLength,
        surface: saleSurface,
        quantity: parseInt(quantity),
        price_per_sqm: isFormat ? (art.price_per_unit ?? 0) : art.price_per_sqm,
        subtotal,
        discount: parseFloat(discount) || 0,
        discount_type: discountType,
        total,
        amount_paid: parseFloat(amountPaid) || 0,
        payment_status: paymentStatus,
        notes: notes.trim() || null,
        pricing_type: art.pricing_type,
      };

      const { data, error } = await supabase.from('sales').insert(saleData).select().single();
      if (error) throw error;
      setLastSale(data);
      resetForm();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement de la vente");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setClientName('');
    setWidth('');
    setLength('');
    setQuantity('1');
    setDiscount('0');
    setAmountPaid('');
    setPaymentStatus('unpaid');
    setNotes('');
  }

  const selectedArticle = articles.find(a => a.id === selectedArticleId);
  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const filteredArticles = articles.filter(a => a.category_id === selectedCategoryId);
  const isFormatArticle = selectedArticle?.pricing_type === 'format';
  const formatDims = isFormatArticle && selectedArticle?.format ? ISO_FORMATS[selectedArticle.format] : null;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Invoice success modal */}
      {lastSale && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl max-w-md w-full overflow-hidden border border-slate-700">
            <div className="p-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <Check className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Vente Enregistree</h3>
                  <p className="text-green-100">Facture N {lastSale.invoice_number}</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-700/50 rounded-lg p-4 space-y-2">
                {[
                  ['Client', lastSale.client_name],
                  ['Article', lastSale.article_name],
                  lastSale.pricing_type === 'format'
                    ? ['Quantite', `${lastSale.quantity} feuille(s)`]
                    : ['Dimensions', `${lastSale.width}m × ${lastSale.length}m`],
                  lastSale.pricing_type !== 'format' ? ['Surface', `${lastSale.surface} m²`] : null,
                ].filter(Boolean).map(row => (
                  <div key={row![0]} className="flex justify-between">
                    <span className="text-slate-400">{row![0]}</span>
                    <span className="font-medium">{row![1]}</span>
                  </div>
                ))}
                <div className="flex justify-between">
                  <span className="text-slate-400">Total</span>
                  <span className="font-bold text-lg text-green-400">{formatCurrency(lastSale.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Statut</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${lastSale.payment_status === 'paid' ? 'bg-green-600' : lastSale.payment_status === 'advance' ? 'bg-yellow-600' : 'bg-red-600'}`}>
                    {lastSale.payment_status === 'paid' ? 'Paye' : lastSale.payment_status === 'advance' ? 'Avance' : 'Non paye'}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { const company = profiles.find(p => p.id === selectedProfileId) || defaultProfile || undefined; generateInvoicePDF(lastSale, company ?? undefined); }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors">
                  Imprimer Facture
                </button>
                <button onClick={() => setLastSale(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-medium transition-colors">Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Nouvelle Vente</h2>
                  <p className="text-sm text-slate-400">Remplissez les informations de la vente</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Client */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Informations Client</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Nom du client *</label>
                    <input type="text" value={clientName} onChange={e => setClientName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Nom du client" required />
                  </div>
                  {profiles.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        <Building2 className="inline w-4 h-4 mr-1 text-slate-400" />Profil entreprise
                      </label>
                      <select value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all">
                        {profiles.map(p => <option key={p.id} value={p.id}>{p.company_name}{p.is_default ? ' (defaut)' : ''}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Category + Article */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Categorie et Article</h3>

                {categories.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      <Tag className="inline w-4 h-4 mr-1 text-slate-400" />Categorie *
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map(cat => (
                        <button key={cat.id} type="button" onClick={() => handleCategoryChange(cat.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${selectedCategoryId === cat.id ? 'text-white border-transparent shadow-md' : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'}`}
                          style={selectedCategoryId === cat.id ? { backgroundColor: cat.color, borderColor: cat.color } : {}}>
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedCategoryId === cat.id ? 'rgba(255,255,255,0.7)' : cat.color }} />
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-700/40 rounded-lg p-4 text-slate-400 text-sm text-center">
                    Aucune categorie configuree. Ajoutez-en dans l'onglet Tarifs.
                  </div>
                )}

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Article *</label>
                    <select value={selectedArticleId} onChange={e => handleArticleChange(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" required>
                      {filteredArticles.length === 0
                        ? <option value="">Aucun article dans cette categorie</option>
                        : filteredArticles.map(art => (
                          <option key={art.id} value={art.id}>
                            {art.name} — {art.pricing_type === 'format'
                              ? `${formatCurrency(art.price_per_unit ?? 0)}/unité${art.format ? ` (${art.format})` : ''}`
                              : `${formatCurrency(art.price_per_sqm)}/m²`}
                          </option>
                        ))
                      }
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Quantite</label>
                    <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      min="1" step="1" />
                  </div>
                </div>
              </div>

              {/* Dimensions — only for sqm articles */}
              {!isFormatArticle ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Dimensions</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Largeur (metres) *</label>
                      <input type="number" value={width} onChange={e => setWidth(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="0.00" step="0.01" min="0" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Longueur (metres) *</label>
                      <input type="number" value={length} onChange={e => setLength(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="0.00" step="0.01" min="0" required />
                    </div>
                  </div>
                </div>
              ) : (
                /* Format info banner */
                selectedArticle?.format && formatDims && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Dimensions</h3>
                    <div className="flex items-center gap-4 p-4 bg-blue-600/10 border border-blue-600/30 rounded-xl">
                      <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center shrink-0">
                        <Ruler className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">Format {selectedArticle.format}</p>
                        <p className="text-sm text-blue-300">
                          {(formatDims.width * 100).toFixed(0)} × {(formatDims.height * 100).toFixed(0)} cm
                          &nbsp;·&nbsp; surface {(formatDims.width * formatDims.height).toFixed(4)} m²
                        </p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-xs text-slate-400">Prix unitaire</p>
                        <p className="font-bold text-white">{formatCurrency(selectedArticle.price_per_unit ?? 0)}</p>
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Discount & Payment */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Remise et Paiement</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Remise</label>
                    <div className="flex gap-2">
                      <input type="number" value={discount} onChange={e => setDiscount(e.target.value)}
                        className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="0" step="0.01" min="0" />
                      <select value={discountType} onChange={e => setDiscountType(e.target.value as DiscountType)}
                        className="px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="percentage">%</option>
                        <option value="fixed">FCFA</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Montant verse</label>
                    <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="0" step="1" min="0" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Notes (optionnel)</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                    rows={2} placeholder="Informations supplementaires..." />
                </div>
              </div>

              <button type="submit" disabled={saving || total === 0}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-medium text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30">
                {saving ? <><Loader2 className="w-5 h-5 animate-spin" />Enregistrement...</> : <><Calculator className="w-5 h-5" />Valider la vente — {formatCurrency(total)}</>}
              </button>
            </form>
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden sticky top-24">
            <div className="p-6 border-b border-slate-700 bg-gradient-to-r from-slate-700 to-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-600/20 rounded-lg flex items-center justify-center">
                  <Calculator className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Recapitulatif</h3>
                  <p className="text-sm text-slate-400">Calcul automatique</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {selectedCategory && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: `${selectedCategory.color}20` }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedCategory.color }} />
                  <span className="text-slate-300">{selectedCategory.name}</span>
                </div>
              )}

              {selectedArticle && (
                <div className="bg-slate-700/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">Article</span>
                    <span className="font-medium text-white text-right max-w-[60%] truncate">{selectedArticle.name}</span>
                  </div>
                  {isFormatArticle ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-sm">Format</span>
                        <span className="font-medium text-white">{selectedArticle.format}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-sm">Prix/unité</span>
                        <span className="font-medium text-white">{formatCurrency(selectedArticle.price_per_unit ?? 0)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">Prix/m²</span>
                      <span className="font-medium text-white">{formatCurrency(selectedArticle.price_per_sqm)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3">
                {isFormatArticle ? (
                  <>
                    {selectedArticle?.format && formatDims && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-sm">Dimensions</span>
                        <span className="text-white">{(formatDims.width * 100).toFixed(0)}×{(formatDims.height * 100).toFixed(0)} cm</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">Quantite</span>
                      <span className="font-medium text-cyan-400">{quantity} feuille(s)</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">Dimensions</span>
                      <span className="font-medium text-white">{width || '0'}m × {length || '0'}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">Surface</span>
                      <span className="font-medium text-cyan-400">{surface} m²</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">Quantite</span>
                      <span className="font-medium text-white">{quantity}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-slate-600 pt-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Sous-total</span>
                  <span className="font-medium text-white">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Remise</span>
                  <span className="font-medium text-red-400">-{formatCurrency(discountAmount)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-600">
                  <span className="text-slate-300 font-medium">Total</span>
                  <span className="font-bold text-2xl text-green-400">{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="border-t border-slate-600 pt-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Montant verse</span>
                  <span className="font-medium text-green-400">{formatCurrency(parseFloat(amountPaid) || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Reste a payer</span>
                  <span className="font-bold text-orange-400">{formatCurrency(remaining)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Statut</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${paymentStatus === 'paid' ? 'bg-green-600 text-green-100' : paymentStatus === 'advance' ? 'bg-yellow-600 text-yellow-100' : 'bg-red-600 text-red-100'}`}>
                    {paymentStatus === 'paid' ? 'Paye' : paymentStatus === 'advance' ? 'Avance' : 'Non paye'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
