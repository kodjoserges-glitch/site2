import { Sale, CompanyProfile, ISO_FORMATS } from '../types';

function fmt(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' FCFA';
}

function fmtDate(date: string): string {
  const d = new Date(date);
  const day = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${day} ${time}`;
}

const defaultCompany = {
  company_name: 'Imprimerie Pro',
  slogan: "Solutions d'impression",
  phone: '',
  email: '',
  address: '',
  invoice_footer: 'Merci pour votre confiance !',
  primary_color: '#2563eb',
};

function row(left: string, right: string, bold = false): string {
  const w = bold ? 'font-weight:700;' : '';
  return `<tr>
    <td style="padding:1px 0;${w}">${left}</td>
    <td style="padding:1px 0;text-align:right;white-space:nowrap;${w}">${right}</td>
  </tr>`;
}

function sep(): string {
  return '<tr><td colspan="2"><div style="border-top:1px dashed #000;margin:5px 0;"></div></td></tr>';
}

export function printReceipt(sale: Sale, company?: Partial<CompanyProfile>): void {
  const c = { ...defaultCompany, ...company };
  const items = sale.sale_items ?? [];
  const remaining = Math.max(0, sale.total - sale.amount_paid);

  const statusLabel = sale.payment_status === 'paid' ? 'PAYE' : sale.payment_status === 'advance' ? 'AVANCE' : 'NON PAYE';
  const statusBg = sale.payment_status === 'paid' ? '#16a34a' : sale.payment_status === 'advance' ? '#d97706' : '#dc2626';

  const discountAmount = sale.discount_type === 'percentage'
    ? sale.subtotal * (sale.discount / 100)
    : sale.discount;

  // Build items rows
  let itemsHtml = '';
  if (items.length > 0) {
    items.forEach((item, i) => {
      const isFormat = item.pricing_type === 'format';
      let dims = '';
      if (isFormat) {
        // Try to identify format from dimensions
        const w = (item.width * 100).toFixed(0);
        const l = (item.length * 100).toFixed(0);
        dims = `${w} x ${l} cm`;
      } else {
        dims = `${item.width}m x ${item.length}m`;
      }
      const unitInfo = isFormat
        ? `${fmt(item.price_per_sqm)}/u`
        : `${fmt(item.price_per_sqm)}/m²`;
      const qtyInfo = isFormat
        ? `x ${item.quantity} u.`
        : `${item.surface} m² x ${item.quantity}`;

      if (i > 0) itemsHtml += sep();
      itemsHtml += `
        <tr><td colspan="2" style="padding-top:3px;font-weight:700;">${item.article_name}</td></tr>
        <tr>
          <td style="color:#555;font-size:9pt;">${dims} — ${qtyInfo}</td>
          <td style="text-align:right;color:#555;font-size:9pt;">${unitInfo}</td>
        </tr>
        ${row('', fmt(item.subtotal), true)}
      `;
    });
  } else {
    // Legacy single-item sale
    const isFormat = sale.pricing_type === 'format';
    const dims = isFormat
      ? `${(sale.width * 100).toFixed(0)} x ${(sale.length * 100).toFixed(0)} cm`
      : `${sale.width}m x ${sale.length}m`;
    const unitInfo = isFormat ? `${fmt(sale.price_per_sqm)}/u` : `${fmt(sale.price_per_sqm)}/m²`;
    const qtyInfo = isFormat ? `x ${sale.quantity}` : `${sale.surface} m² x ${sale.quantity}`;
    itemsHtml = `
      <tr><td colspan="2" style="font-weight:700;">${sale.article_name}</td></tr>
      <tr>
        <td style="color:#555;font-size:9pt;">${dims} — ${qtyInfo}</td>
        <td style="text-align:right;color:#555;font-size:9pt;">${unitInfo}</td>
      </tr>
      ${row('', fmt(sale.subtotal), true)}
    `;
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Ticket ${sale.invoice_number}</title>
<style>
  @page {
    size: 4in auto;
    margin: 3mm 4mm;
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 10pt;
    color: #000;
    margin: 0;
    padding: 0;
    width: 4in;
    background: #fff;
  }
  h1 {
    font-size: 15pt;
    text-align: center;
    margin: 0 0 2px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .slogan {
    text-align: center;
    font-size: 8pt;
    color: #555;
    margin: 0 0 4px;
  }
  .contact {
    text-align: center;
    font-size: 8pt;
    color: #333;
    margin-bottom: 2px;
  }
  .divider-solid {
    border: none;
    border-top: 2px solid #000;
    margin: 5px 0;
  }
  .divider-dash {
    border: none;
    border-top: 1px dashed #000;
    margin: 5px 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
  }
  .invoice-meta {
    font-size: 9pt;
    margin: 4px 0;
  }
  .invoice-meta td:last-child {
    text-align: right;
    font-weight: 700;
  }
  .total-row td {
    font-size: 13pt;
    font-weight: 700;
    padding: 3px 0;
  }
  .status-badge {
    display: block;
    text-align: center;
    font-weight: 700;
    font-size: 11pt;
    letter-spacing: 2px;
    padding: 4px 0;
    color: #fff;
    background: ${statusBg};
    margin: 6px 0;
    border-radius: 3px;
  }
  .footer {
    text-align: center;
    font-size: 8pt;
    color: #555;
    margin-top: 6px;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

  <h1>${c.company_name}</h1>
  ${c.slogan ? `<p class="slogan">${c.slogan}</p>` : ''}
  ${c.phone ? `<p class="contact">Tel: ${c.phone}</p>` : ''}
  ${c.address ? `<p class="contact">${c.address}</p>` : ''}

  <hr class="divider-solid">

  <table class="invoice-meta">
    <tr>
      <td>Facture N°</td>
      <td>${sale.invoice_number}</td>
    </tr>
    <tr>
      <td>Date</td>
      <td>${fmtDate(sale.created_at)}</td>
    </tr>
    <tr>
      <td>Client</td>
      <td>${sale.client_name}</td>
    </tr>
  </table>

  <hr class="divider-solid">

  <table>
    ${itemsHtml}
  </table>

  <hr class="divider-solid">

  <table>
    ${row('Sous-total', fmt(sale.subtotal))}
    ${discountAmount > 0 ? row(
      sale.discount_type === 'percentage' ? `Remise (${sale.discount}%)` : 'Remise',
      `-${fmt(discountAmount)}`
    ) : ''}
    ${discountAmount > 0 ? sep() : ''}
    <tr class="total-row">
      <td>TOTAL</td>
      <td style="text-align:right;">${fmt(sale.total)}</td>
    </tr>
    ${sep()}
    ${row('Verse', fmt(sale.amount_paid))}
    ${row('Reste a payer', fmt(remaining), remaining > 0)}
  </table>

  <span class="status-badge">${statusLabel}</span>

  ${sale.notes ? `<hr class="divider-dash"><p style="font-size:8pt;font-style:italic;color:#555;margin:2px 0;">${sale.notes}</p>` : ''}

  <hr class="divider-solid">
  <p class="footer">${c.invoice_footer}</p>
  ${c.email ? `<p class="footer">${c.email}</p>` : ''}

</body>
</html>`;

  const win = window.open('', '_blank', 'width=400,height=700,menubar=no,toolbar=no');
  if (!win) {
    alert('Veuillez autoriser les popups pour imprimer.');
    return;
  }
  win.document.write(html);
  win.document.close();
  // Short delay to ensure styles are applied before printing
  win.onload = () => {
    win.focus();
    win.print();
    win.close();
  };
  // Fallback if onload already fired
  setTimeout(() => {
    if (!win.closed) {
      win.focus();
      win.print();
    }
  }, 500);
}
