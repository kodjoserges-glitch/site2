import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, CompanyProfile } from '../types';
import { formatCurrency, formatDateShort } from './utils';

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [37, 99, 235];
}

const defaultCompany: Omit<CompanyProfile, 'id' | 'is_default' | 'created_at' | 'updated_at'> = {
  company_name: 'Imprimerie Pro',
  slogan: 'Solutions d\'impression professionnelle',
  logo_url: null,
  phone: '+225 XX XX XX XX',
  email: 'contact@imprimerie-pro.com',
  address: 'Abidjan, Cote d\'Ivoire',
  website: 'www.imprimerie-pro.com',
  invoice_footer: 'Merci pour votre confiance !',
  primary_color: '#2563eb',
};

export function generateInvoicePDF(sale: Sale, company?: Partial<CompanyProfile>): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const c = { ...defaultCompany, ...company };
  const primaryRgb = hexToRgb(c.primary_color);

  // Header background
  doc.setFillColor(...primaryRgb);
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(c.company_name.toUpperCase(), pageWidth / 2, 18, { align: 'center' });

  if (c.slogan) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(c.slogan, pageWidth / 2, 28, { align: 'center' });
  }

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURE', 20, 60);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('N Facture:', 20, 72);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(sale.invoice_number, 55, 72);

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Date:', 20, 80);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDateShort(sale.created_at), 55, 80);

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Client:', pageWidth - 60, 65);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(sale.client_name, pageWidth - 60, 72);

  doc.setDrawColor(226, 232, 240);
  doc.line(20, 90, pageWidth - 20, 90);

  doc.setTextColor(...primaryRgb);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DETAIL DE LA COMMANDE', 20, 102);

  const items = sale.sale_items;

  if (items && items.length > 0) {
    // Multi-item invoice
    const rows = items.map(item => {
      const isFormat = item.pricing_type === 'format';
      const dims = isFormat
        ? `${(item.width * 100).toFixed(0)} x ${(item.length * 100).toFixed(0)} cm`
        : `${item.width}m x ${item.length}m`;
      const unitInfo = isFormat
        ? `${formatCurrency(item.price_per_sqm)}/unite`
        : `${formatCurrency(item.price_per_sqm)}/m2`;
      const qtyInfo = isFormat
        ? `${item.quantity} u.`
        : `${item.surface} m2 x ${item.quantity}`;
      return [item.article_name, dims, qtyInfo, unitInfo, formatCurrency(item.subtotal)];
    });

    autoTable(doc, {
      startY: 110,
      head: [['Article', 'Dimensions', 'Surface / Qte', 'Prix unitaire', 'Sous-total']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: primaryRgb, textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 20, right: 20 },
      styles: { cellPadding: 5, fontSize: 9 },
      columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } },
    });
  } else {
    // Single-item legacy invoice
    autoTable(doc, {
      startY: 110,
      head: [['Article', 'Dimensions', 'Surface', 'Prix/m2', 'Quantite', 'Total']],
      body: [[
        sale.article_name,
        `${sale.width}m x ${sale.length}m`,
        `${sale.surface} m2`,
        formatCurrency(sale.price_per_sqm),
        sale.quantity.toString(),
        formatCurrency(sale.subtotal),
      ]],
      theme: 'grid',
      headStyles: { fillColor: primaryRgb, textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 20, right: 20 },
      styles: { cellPadding: 6, fontSize: 10 },
    });
  }

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Sous-total:', pageWidth - 90, finalY);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(sale.subtotal), pageWidth - 20, finalY, { align: 'right' });

  if (sale.discount > 0) {
    doc.setTextColor(100, 116, 139);
    doc.text(`Remise${sale.discount_type === 'percentage' ? ` (${sale.discount}%)` : ''}:`, pageWidth - 90, finalY + 8);
    doc.setTextColor(234, 88, 12);
    const discountVal = sale.discount_type === 'percentage'
      ? sale.subtotal * (sale.discount / 100)
      : sale.discount;
    doc.text(`-${formatCurrency(discountVal)}`, pageWidth - 20, finalY + 8, { align: 'right' });
  }

  doc.setDrawColor(226, 232, 240);
  doc.line(pageWidth - 90, finalY + 15, pageWidth - 20, finalY + 15);

  doc.setFontSize(14);
  doc.setTextColor(...primaryRgb);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', pageWidth - 90, finalY + 25);
  doc.setTextColor(16, 185, 129);
  doc.text(formatCurrency(sale.total), pageWidth - 20, finalY + 25, { align: 'right' });

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Montant verse:', pageWidth - 90, finalY + 35);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(sale.amount_paid), pageWidth - 20, finalY + 35, { align: 'right' });

  const remaining = sale.total - sale.amount_paid;
  doc.setTextColor(100, 116, 139);
  doc.text('Reste a payer:', pageWidth - 90, finalY + 43);
  doc.setTextColor(remaining > 0 ? 234 : 16, remaining > 0 ? 88 : 185, remaining > 0 ? 12 : 129);
  doc.text(formatCurrency(remaining), pageWidth - 20, finalY + 43, { align: 'right' });

  const statusY = finalY + 53;
  const statusText = sale.payment_status === 'paid' ? 'PAYE' : sale.payment_status === 'advance' ? 'AVANCE' : 'NON PAYE';
  const statusColor: [number, number, number] = sale.payment_status === 'paid' ? [16, 185, 129] : sale.payment_status === 'advance' ? [234, 179, 8] : [239, 68, 68];
  doc.setFillColor(...statusColor);
  doc.roundedRect(pageWidth - 90, statusY, 70, 12, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(statusText, pageWidth - 55, statusY + 8, { align: 'center' });

  if (sale.notes) {
    const notesY = statusY + 25;
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Notes:', 20, notesY);
    doc.setTextColor(71, 85, 105);
    doc.text(sale.notes, 20, notesY + 6);
  }

  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(226, 232, 240);
  doc.line(20, footerY - 10, pageWidth - 20, footerY - 10);
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  if (c.invoice_footer) {
    doc.text(c.invoice_footer, pageWidth / 2, footerY, { align: 'center' });
  }

  const contactParts = [c.phone, c.email, c.website].filter(Boolean);
  if (contactParts.length) {
    doc.text(`${c.company_name} - ${contactParts.join(' - ')}`, pageWidth / 2, footerY + 6, { align: 'center' });
  }
  if (c.address) {
    doc.text(c.address, pageWidth / 2, footerY + 12, { align: 'center' });
  }

  doc.save(`facture_${sale.invoice_number}.pdf`);
}
