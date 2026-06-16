import { useState, useEffect } from 'react';
import {
  History,
  Download,
  FileSpreadsheet,
  Printer,
  Trash2,
  Loader2,
  RefreshCw,
  Calendar,
  Ruler,
  FileDown,
  Lock,
  ShieldAlert,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Sale, CompanyProfile, UserProfile } from '../types';
import { formatCurrency, formatDate, exportToCSV } from '../lib/utils';
import { generateInvoicePDF } from '../lib/pdf';
import { printReceipt } from '../lib/receipt';

interface Props {
  profiles: CompanyProfile[];
  defaultProfile: CompanyProfile | null;
  currentUser: UserProfile;
}

interface DeleteRequest {
  saleId: string;
  invoiceNumber: string;
  clientName: string;
  total: number;
}

export function SalesHistory({ profiles, defaultProfile, currentUser }: Props) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  // Delete auth modal state
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canDelete = currentUser.role === 'admin' || currentUser.role === 'manager';

  useEffect(() => {
    fetchSales();
  }, [filterDate]);

  async function fetchSales() {
    setLoading(true);
    try {
      const startOfDay = new Date(filterDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filterDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSales(data || []);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  }

  function requestDelete(sale: Sale) {
    if (!canDelete) return;
    setDeleteRequest({
      saleId: sale.id,
      invoiceNumber: sale.invoice_number,
      clientName: sale.client_name,
      total: sale.total,
    });
    setDeletePassword('');
    setDeleteError('');
    setShowDeletePassword(false);
  }

  function cancelDelete() {
    setDeleteRequest(null);
    setDeletePassword('');
    setDeleteError('');
  }

  async function confirmDelete() {
    if (!deleteRequest || !deletePassword.trim()) return;
    setDeleteLoading(true);
    setDeleteError('');

    try {
      // Verify the manager/admin's own password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: deletePassword,
      });

      if (authError) {
        setDeleteError('Mot de passe incorrect. Suppression annulee.');
        setDeleteLoading(false);
        return;
      }

      // Password verified — proceed with deletion
      const { error: deleteError } = await supabase
        .from('sales')
        .delete()
        .eq('id', deleteRequest.saleId);

      if (deleteError) throw deleteError;

      setSales(prev => prev.filter(s => s.id !== deleteRequest.saleId));
      cancelDelete();
    } catch (err) {
      console.error(err);
      setDeleteError('Erreur lors de la suppression. Reessayez.');
    } finally {
      setDeleteLoading(false);
    }
  }

  function handlePrintInvoice(sale: Sale) {
    const company = profiles.find(p => p.id === defaultProfile?.id) ?? defaultProfile ?? undefined;
    printReceipt(sale, company ?? undefined);
  }

  function handleDownloadPDF(sale: Sale) {
    const company = profiles.find(p => p.id === defaultProfile?.id) ?? defaultProfile ?? undefined;
    generateInvoicePDF(sale, company ?? undefined);
  }

  function handleExportCSV() {
    if (sales.length === 0) {
      alert('Aucune vente a exporter');
      return;
    }
    exportToCSV(sales);
  }

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalPaid = sales.reduce((sum, s) => sum + s.amount_paid, 0);
  const totalRemaining = totalRevenue - totalPaid;

  return (
    <div className="space-y-6">

      {/* Delete Authorization Modal */}
      {deleteRequest && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl max-w-md w-full overflow-hidden border border-red-600/40 shadow-2xl">
            {/* Header */}
            <div className="bg-red-600/15 border-b border-red-600/30 p-5 flex items-start gap-4">
              <div className="w-11 h-11 bg-red-600/25 rounded-full flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Autorisation requise</h3>
                <p className="text-sm text-slate-400 mt-0.5">
                  Saisissez votre mot de passe pour autoriser cette suppression
                </p>
              </div>
            </div>

            {/* Sale info */}
            <div className="px-5 pt-5 pb-3">
              <div className="bg-slate-700/50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Facture</span>
                  <span className="font-mono text-blue-400 font-medium">{deleteRequest.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Client</span>
                  <span className="text-white font-medium">{deleteRequest.clientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Montant</span>
                  <span className="text-green-400 font-bold">{formatCurrency(deleteRequest.total)}</span>
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2 text-xs text-amber-400 bg-amber-600/10 border border-amber-600/20 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Cette action est irréversible. La vente sera definitivement supprimee.</span>
              </div>
            </div>

            {/* Password input */}
            <div className="px-5 pb-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Votre mot de passe ({currentUser.role === 'admin' ? 'Administrateur' : 'Manager'})
                </label>
                <div className="relative">
                  <input
                    type={showDeletePassword ? 'text' : 'password'}
                    value={deletePassword}
                    onChange={e => { setDeletePassword(e.target.value); setDeleteError(''); }}
                    onKeyDown={e => e.key === 'Enter' && confirmDelete()}
                    className="w-full px-4 py-3 pr-12 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    placeholder="Mot de passe..."
                    autoFocus
                    disabled={deleteLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {showDeletePassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {deleteError && (
                  <p className="mt-2 text-sm text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {deleteError}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={cancelDelete}
                  disabled={deleteLoading}
                  className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteLoading || !deletePassword.trim()}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {deleteLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Confirmer la suppression
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                <History className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Historique des Ventes</h2>
                <p className="text-sm text-slate-400">
                  {sales.length} vente(s) ce jour
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
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

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
              <span className="text-xl font-bold text-green-400">FCA</span>
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Journalier</p>
              <p className="text-xl font-bold text-white">{formatCurrency(totalRevenue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <span className="text-xl font-bold text-blue-400">$</span>
            </div>
            <div>
              <p className="text-sm text-slate-400">Montant Encaisse</p>
              <p className="text-xl font-bold text-white">{formatCurrency(totalPaid)}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600/20 rounded-lg flex items-center justify-center">
              <span className="text-xl font-bold text-orange-400">!</span>
            </div>
            <div>
              <p className="text-sm text-slate-400">Reste a Payer</p>
              <p className="text-xl font-bold text-white">{formatCurrency(totalRemaining)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium text-white transition-colors"
        >
          <Download className="w-4 h-4" />
          Exporter CSV
        </button>
      </div>

      {/* Permission notice for vendeur */}
      {!canDelete && (
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-400">
          <Lock className="w-4 h-4 text-slate-500 shrink-0" />
          La suppression d'une vente necessite l'autorisation d'un Manager ou Administrateur.
        </div>
      )}

      {/* Sales Table */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <FileSpreadsheet className="w-12 h-12 mb-4" />
            <p>Aucune vente enregistree ce jour</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Date et Heure
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Facture
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Article
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Dim. / Format
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Surface / Qte
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="py-3 px-4 text-sm text-slate-300">
                      {formatDate(sale.created_at)}
                    </td>
                    <td className="py-3 px-4 text-sm font-mono text-blue-400">
                      {sale.invoice_number}
                    </td>
                    <td className="py-3 px-4 text-sm text-white font-medium">
                      {sale.client_name}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-300">
                      {sale.sale_items && sale.sale_items.length > 1 ? (
                        <div className="space-y-0.5">
                          {sale.sale_items.map((item, i) => (
                            <div key={item.id ?? i} className="text-xs text-slate-400 truncate max-w-[160px]">
                              {item.article_name}
                            </div>
                          ))}
                        </div>
                      ) : (
                        sale.article_name
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-slate-300">
                      {sale.sale_items && sale.sale_items.length > 1 ? (
                        <span className="text-xs text-slate-500">{sale.sale_items.length} articles</span>
                      ) : sale.pricing_type === 'format' ? (
                        <span className="inline-flex items-center gap-1">
                          <Ruler className="w-3 h-3 text-blue-400" />
                          {(sale.width * 100).toFixed(0)}×{(sale.length * 100).toFixed(0)} cm
                        </span>
                      ) : (
                        `${sale.width}m × ${sale.length}m`
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-medium">
                      {sale.sale_items && sale.sale_items.length > 1 ? (
                        <span className="text-slate-500">—</span>
                      ) : sale.pricing_type === 'format' ? (
                        <span className="text-blue-400">{sale.quantity} unité(s)</span>
                      ) : (
                        <span className="text-cyan-400">{sale.surface} m²</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-green-400 font-bold">
                      {formatCurrency(sale.total)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                        sale.payment_status === 'paid'
                          ? 'bg-green-600/20 text-green-400'
                          : sale.payment_status === 'advance'
                          ? 'bg-yellow-600/20 text-yellow-400'
                          : 'bg-red-600/20 text-red-400'
                      }`}>
                        {sale.payment_status === 'paid'
                          ? 'Paye'
                          : sale.payment_status === 'advance'
                          ? 'Avance'
                          : 'Non paye'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handlePrintInvoice(sale)}
                          className="p-1.5 hover:bg-blue-600/20 rounded text-slate-300 hover:text-blue-400 transition-colors"
                          title="Imprimer ticket thermique"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(sale)}
                          className="p-1.5 hover:bg-slate-600 rounded text-slate-400 hover:text-white transition-colors"
                          title="Telecharger PDF A4"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                        {canDelete ? (
                          <button
                            onClick={() => requestDelete(sale)}
                            className="p-1.5 hover:bg-red-600/20 rounded text-slate-400 hover:text-red-400 transition-colors"
                            title="Supprimer (autorisation requise)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span
                            className="p-1.5 text-slate-600 cursor-not-allowed"
                            title="Suppression non autorisee - contacter un responsable"
                          >
                            <Lock className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
