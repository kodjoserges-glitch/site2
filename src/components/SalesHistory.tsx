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
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Sale, CompanyProfile } from '../types';
import { formatCurrency, formatDate, exportToCSV } from '../lib/utils';
import { generateInvoicePDF } from '../lib/pdf';

interface Props {
  profiles: CompanyProfile[];
  defaultProfile: CompanyProfile | null;
}

export function SalesHistory({ profiles, defaultProfile }: Props) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

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

  async function handleDeleteSale(id: string) {
    if (!confirm('Etes-vous sur de vouloir supprimer cette vente?')) return;

    try {
      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSales(sales.filter(s => s.id !== id));
    } catch (error) {
      console.error('Error deleting sale:', error);
      alert('Erreur lors de la suppression');
    }
  }

  function handlePrintInvoice(sale: Sale) {
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
                          className="p-1.5 hover:bg-slate-600 rounded text-slate-300 hover:text-white transition-colors"
                          title="Imprimer"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSale(sale.id)}
                          className="p-1.5 hover:bg-red-600/20 rounded text-slate-300 hover:text-red-400 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
