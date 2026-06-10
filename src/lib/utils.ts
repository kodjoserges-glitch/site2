export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('XOF', 'FCFA');
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatDateShort(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function calculateSurface(width: number, length: number): number {
  return Number((width * length).toFixed(2));
}

export function calculateTotal(
  surface: number,
  pricePerSqm: number,
  quantity: number,
  discount: number,
  discountType: 'percentage' | 'fixed'
): { subtotal: number; discountAmount: number; total: number } {
  const subtotal = surface * pricePerSqm * quantity;
  const discountAmount = discountType === 'percentage'
    ? subtotal * (discount / 100)
    : discount;
  const total = Math.max(0, subtotal - discountAmount);
  return {
    subtotal: Number(subtotal.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

export function exportToCSV(sales: Sale[]): void {
  const headers = [
    'Date & Heure',
    'N° Facture',
    'Client',
    'Article',
    'Largeur (m)',
    'Longueur (m)',
    'Surface (m²)',
    'Quantité',
    'Prix/m²',
    'Sous-total',
    'Remise',
    'Total',
    'Montant versé',
    'Reste',
    'Statut',
  ];

  const rows = sales.map(sale => [
    formatDate(sale.created_at),
    sale.invoice_number,
    sale.client_name,
    sale.article_name,
    sale.width,
    sale.length,
    sale.surface,
    sale.quantity,
    sale.price_per_sqm,
    sale.subtotal,
    sale.discount,
    sale.total,
    sale.amount_paid,
    sale.total - sale.amount_paid,
    sale.payment_status === 'paid' ? 'Payé' : sale.payment_status === 'advance' ? 'Avance' : 'Non payé',
  ]);

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(';')),
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `ventes_${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
