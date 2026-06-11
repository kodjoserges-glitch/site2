import { useState, useEffect } from 'react';
import { Calculator, ShoppingCart, Loader2, Check, Building2, Tag, Ruler, Plus, Trash2, PackageOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Article, Category, Sale, SaleItem, PaymentStatus, DiscountType, CompanyProfile, ISO_FORMATS } from '../types';
import { formatCurrency, calculateSurface } from '../lib/utils';
import { generateInvoicePDF } from '../lib/pdf';

interface Props {
  profiles: CompanyProfile[];
  defaultProfile: CompanyProfile | null;
}

interface LineItemState {
  id: string;
  categoryId: string;
  articleId: string;
  width: string;
  length: string;
  quantity: string;
}

function makeNewLine(categories: Category[], articles: Article[], prevCategoryId?: string): LineItemState {
  const catId = prevCategoryId || categories[0]?.id || '';
  const firstArt = articles.find(a => a.category_id === catId);
  return {
    id: crypto.randomUUID(),
    categoryId: catId,
    articleId: firstArt?.id ?? '',
    width: '',
    length: '',
    quantity: '1',
  };
}

export function NewSale({ profiles, defaultProfile }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [clientName, setClientName] = useState('');
  const [lineItems, setLineItems] = useState<LineItemState[]>([]);
  const [discount, setDiscount] = useState('0');
  const [discountType, setDiscountType] = useState<DiscountType>('percentage');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');

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
      setLineItems([makeNewLine(cats, arts)]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Compute derived values for a single line
  function computeLine(line: LineItemState) {
    const art = articles.find(a => a.id === line.articleId) ?? null;
    if (!art) return { ...line, art, surface: 0, subtotal: 0 };
    const q = Math.max(1, parseInt(line.quantity) || 1);
    if (art.pricing_type === 'format' && art.format) {
      const dims = ISO_FORMATS[art.format];
      const surf = Number((dims.width * dims.height).toFixed(4));
      const sub = (art.price_per_unit ?? 0) * q;
      return { ...line, art, surface: surf, subtotal: Number(sub.toFixed(2)) };
    }
    const w = parseFloat(line.width) || 0;
    const l = parseFloat(line.length) || 0;
    const surf = calculateSurface(w, l);
    if (surf === 0) return { ...line, art, surface: 0, subtotal: 0 };
    const sub = surf * art.price_per_sqm * q;
    return { ...line, art, surface: surf, subtotal: Number(sub.toFixed(2)) };
  }

  const computedLines = lineItems.map(computeLine);
  const linesSubtotal = computedLines.reduce((s, l) => s + l.subtotal, 0);
  const discountValue = parseFloat(discount) || 0;
  const discountAmount = Number(
    (discountType === 'percentage' ? linesSubtotal * (discountValue / 100) : discountValue).toFixed(2)
  );
  const grandTotal = Math.max(0, Number((linesSubtotal - discountAmount).toFixed(2)));
  const amountPaidNum = parseFloat(amountPaid) || 0;
  const remaining = Math.max(0, Number((grandTotal - amountPaidNum).toFixed(2)));
  const paymentStatus: PaymentStatus =
    grandTotal > 0 && amountPaidNum >= grandTotal ? 'paid' : amountPaidNum > 0 ? 'advance' : 'unpaid';

  function updateLine(id: string, patch: Partial<LineItemState>) {
    setLineItems(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  }

  function changeCategoryForLine(id: string, catId: string) {
    const firstArt = articles.find(a => a.category_id === catId);
    setLineItems(prev =>
      prev.map(l =>
        l.id === id ? { ...l, categoryId: catId, articleId: firstArt?.id ?? '', width: '', length: '' } : l
      )
    );
  }

  function changeArticleForLine(id: string, artId: string) {
    setLineItems(prev =>
      prev.map(l => (l.id === id ? { ...l, articleId: artId, width: '', length: '' } : l))
    );
  }

  function addLine() {
    const lastLine = lineItems[lineItems.length - 1];
    setLineItems(prev => [...prev, makeNewLine(categories, articles, lastLine?.categoryId)]);
  }

  function removeLine(id: string) {
    setLineItems(prev => prev.filter(l => l.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim()) return;

    // Validate all lines
    for (const cl of computedLines) {
      if (!cl.art) { alert('Un article est invalide dans la liste.'); return; }
      if (cl.art.pricing_type !== 'format' && cl.surface === 0) {
        alert(`Veuillez saisir les dimensions pour "${cl.art.name}".`);
        return;
      }
      if (cl.subtotal === 0) {
        alert(`Le sous-total de "${cl.art.name}" est nul.`);
        return;
      }
    }

    setSaving(true);
    try {
      const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
      const firstLine = computedLines[0];
      const isMulti = computedLines.length > 1;

      const saleData = {
        invoice_number: invoiceNumber,
        client_name: clientName.trim(),
        article_id: firstLine.art!.id,
        article_name: isMulti
          ? `${computedLines.length} articles`
          : firstLine.art!.name,
        width: firstLine.art!.pricing_type === 'format' && firstLine.art!.format
          ? ISO_FORMATS[firstLine.art!.format!].width
          : parseFloat(firstLine.width) || 0,
        length: firstLine.art!.pricing_type === 'format' && firstLine.art!.format
          ? ISO_FORMATS[firstLine.art!.format!].height
          : parseFloat(firstLine.length) || 0,
        surface: firstLine.surface,
        quantity: parseInt(firstLine.quantity) || 1,
        price_per_sqm: firstLine.art!.pricing_type === 'format'
          ? (firstLine.art!.price_per_unit ?? 0)
          : firstLine.art!.price_per_sqm,
        subtotal: linesSubtotal,
        discount: discountValue,
        discount_type: discountType,
        total: grandTotal,
        amount_paid: amountPaidNum,
        payment_status: paymentStatus,
        notes: notes.trim() || null,
        pricing_type: firstLine.art!.pricing_type,
      };

      const { data: saleRecord, error: saleError } = await supabase
        .from('sales')
        .insert(saleData)
        .select()
        .single();
      if (saleError) throw saleError;

      // Insert all line items
      const itemsPayload = computedLines.map(cl => ({
        sale_id: saleRecord.id,
        article_id: cl.art!.id,
        article_name: cl.art!.name,
        pricing_type: cl.art!.pricing_type,
        width: cl.art!.pricing_type === 'format' && cl.art!.format
          ? ISO_FORMATS[cl.art!.format!].width
          : parseFloat(cl.width) || 0,
        length: cl.art!.pricing_type === 'format' && cl.art!.format
          ? ISO_FORMATS[cl.art!.format!].height
          : parseFloat(cl.length) || 0,
        surface: cl.surface,
        quantity: parseInt(cl.quantity) || 1,
        price_per_sqm: cl.art!.pricing_type === 'format'
          ? (cl.art!.price_per_unit ?? 0)
          : cl.art!.price_per_sqm,
        subtotal: cl.subtotal,
      }));

      const { data: itemsData, error: itemsError } = await supabase
        .from('sale_items')
        .insert(itemsPayload)
        .select();
      if (itemsError) throw itemsError;

      setLastSale({ ...saleRecord, sale_items: itemsData ?? [] });
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
    setDiscount('0');
    setAmountPaid('');
    setNotes('');
    setLineItems([makeNewLine(categories, articles)]);
  }

  const selectedProfile = profiles.find(p => p.id === selectedProfileId) ?? defaultProfile ?? undefined;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Success modal */}
      {lastSale && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl max-w-lg w-full overflow-hidden border border-slate-700">
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
                <div className="flex justify-between">
                  <span className="text-slate-400">Client</span>
                  <span className="font-medium">{lastSale.client_name}</span>
                </div>
                {lastSale.sale_items && lastSale.sale_items.length > 0 ? (
                  <div className="space-y-1">
                    {lastSale.sale_items.map((item, i) => (
                      <div key={item.id ?? i} className="flex justify-between text-sm">
                        <span className="text-slate-400 truncate max-w-[55%]">{item.article_name}</span>
                        <span className="text-slate-300">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Article</span>
                    <span className="font-medium">{lastSale.article_name}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-600">
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
                <button
                  onClick={() => generateInvoicePDF(lastSale, selectedProfile)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  Imprimer Facture
                </button>
                <button
                  onClick={() => setLastSale(null)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Client info */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
              <div className="p-5 border-b border-slate-700 flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-600/20 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Nouvelle Vente</h2>
                  <p className="text-xs text-slate-400">Ajoutez un ou plusieurs articles</p>
                </div>
              </div>
              <div className="p-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Nom du client *</label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={e => setClientName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Nom du client"
                      required
                    />
                  </div>
                  {profiles.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        <Building2 className="inline w-4 h-4 mr-1 text-slate-400" />Profil entreprise
                      </label>
                      <select
                        value={selectedProfileId}
                        onChange={e => setSelectedProfileId(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      >
                        {profiles.map(p => (
                          <option key={p.id} value={p.id}>{p.company_name}{p.is_default ? ' (defaut)' : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-3">
              {lineItems.map((line, index) => {
                const cl = computedLines[index];
                const art = cl?.art ?? null;
                const isFormat = art?.pricing_type === 'format';
                const formatDims = isFormat && art?.format ? ISO_FORMATS[art.format] : null;
                const filteredArticles = articles.filter(a => a.category_id === line.categoryId);

                return (
                  <div key={line.id} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                    {/* Line header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 bg-slate-700/30">
                      <div className="flex items-center gap-2">
                        <PackageOpen className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-semibold text-slate-300">
                          Article {index + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {cl && cl.subtotal > 0 && (
                          <span className="text-sm font-bold text-cyan-400">{formatCurrency(cl.subtotal)}</span>
                        )}
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(line.id)}
                            className="p-1.5 hover:bg-red-600/20 rounded text-slate-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Category */}
                      {categories.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            <Tag className="inline w-3 h-3 mr-1" />Categorie
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {categories.map(cat => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => changeCategoryForLine(line.id, cat.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${line.categoryId === cat.id ? 'text-white border-transparent shadow-md' : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'}`}
                                style={line.categoryId === cat.id ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
                              >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: line.categoryId === cat.id ? 'rgba(255,255,255,0.7)' : cat.color }} />
                                {cat.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Article + Quantity */}
                      <div className="grid sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-slate-400 mb-1.5">Article *</label>
                          <select
                            value={line.articleId}
                            onChange={e => changeArticleForLine(line.id, e.target.value)}
                            className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            required
                          >
                            {filteredArticles.length === 0
                              ? <option value="">Aucun article</option>
                              : filteredArticles.map(a => (
                                <option key={a.id} value={a.id}>
                                  {a.name} — {a.pricing_type === 'format'
                                    ? `${formatCurrency(a.price_per_unit ?? 0)}/unite${a.format ? ` (${a.format})` : ''}`
                                    : `${formatCurrency(a.price_per_sqm)}/m²`}
                                </option>
                              ))
                            }
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1.5">Quantite</label>
                          <input
                            type="number"
                            value={line.quantity}
                            onChange={e => updateLine(line.id, { quantity: e.target.value })}
                            className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            min="1"
                            step="1"
                          />
                        </div>
                      </div>

                      {/* Dimensions */}
                      {isFormat && formatDims ? (
                        <div className="flex items-center gap-3 p-3 bg-blue-600/10 border border-blue-600/30 rounded-xl">
                          <Ruler className="w-4 h-4 text-blue-400 shrink-0" />
                          <div className="text-sm">
                            <span className="font-semibold text-white">Format {art?.format}</span>
                            <span className="text-blue-300 ml-2">
                              {(formatDims.width * 100).toFixed(0)} × {(formatDims.height * 100).toFixed(0)} cm
                            </span>
                          </div>
                          <div className="ml-auto text-right">
                            <span className="text-xs text-slate-400">Prix/unite</span>
                            <p className="text-sm font-bold text-white">{formatCurrency(art?.price_per_unit ?? 0)}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Largeur (m) *</label>
                            <input
                              type="number"
                              value={line.width}
                              onChange={e => updateLine(line.id, { width: e.target.value })}
                              className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Longueur (m) *</label>
                            <input
                              type="number"
                              value={line.length}
                              onChange={e => updateLine(line.id, { length: e.target.value })}
                              className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                              required
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add article button */}
              <button
                type="button"
                onClick={addLine}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-2xl text-slate-400 hover:text-blue-400 transition-all text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Ajouter un article
              </button>
            </div>

            {/* Discount & Payment */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Remise et Paiement</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Remise</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={discount}
                      onChange={e => setDiscount(e.target.value)}
                      className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="0"
                      step="0.01"
                      min="0"
                    />
                    <select
                      value={discountType}
                      onChange={e => setDiscountType(e.target.value as DiscountType)}
                      className="px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="percentage">%</option>
                      <option value="fixed">FCFA</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Montant verse</label>
                  <input
                    type="number"
                    value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="0"
                    step="1"
                    min="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Notes (optionnel)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                  rows={2}
                  placeholder="Informations supplementaires..."
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || grandTotal === 0}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-medium text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30"
            >
              {saving ? (
                <><Loader2 className="w-5 h-5 animate-spin" />Enregistrement...</>
              ) : (
                <><Calculator className="w-5 h-5" />Valider la vente — {formatCurrency(grandTotal)}</>
              )}
            </button>
          </form>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden sticky top-24">
            <div className="p-5 border-b border-slate-700 bg-gradient-to-r from-slate-700 to-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-cyan-600/20 rounded-lg flex items-center justify-center">
                  <Calculator className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Recapitulatif</h3>
                  <p className="text-xs text-slate-400">{computedLines.length} article(s)</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Lines summary */}
              <div className="space-y-2">
                {computedLines.map((cl, i) => (
                  <div key={cl.id} className="bg-slate-700/40 rounded-lg p-3 space-y-1.5">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs text-slate-400">Art. {i + 1}</span>
                      <span className="text-xs font-semibold text-white text-right truncate max-w-[70%]">
                        {cl.art?.name ?? '—'}
                      </span>
                    </div>
                    {cl.art && (
                      <>
                        {cl.art.pricing_type === 'format' && cl.art.format ? (
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Format {cl.art.format} × {cl.quantity}</span>
                            <span className="text-cyan-400 font-medium">{formatCurrency(cl.subtotal)}</span>
                          </div>
                        ) : (
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">
                              {cl.width || '0'}m × {cl.length || '0'}m × {cl.quantity}
                            </span>
                            <span className="text-cyan-400 font-medium">{formatCurrency(cl.subtotal)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-600 pt-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Sous-total</span>
                  <span className="font-medium text-white">{formatCurrency(linesSubtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">Remise</span>
                    <span className="font-medium text-red-400">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-600">
                  <span className="text-slate-300 font-medium">Total</span>
                  <span className="font-bold text-2xl text-green-400">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <div className="border-t border-slate-600 pt-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Montant verse</span>
                  <span className="font-medium text-green-400">{formatCurrency(amountPaidNum)}</span>
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
