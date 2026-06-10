const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';

const KEYS = {
  token: 'gdrive_token',
  expiry: 'gdrive_expiry',
  sheetId: 'gdrive_sheet_id',
} as const;

let _client: any = null;
let _resolve: ((t: string) => void) | null = null;
let _reject: ((e: Error) => void) | null = null;

async function loadGIS(): Promise<void> {
  if ((window as any).google?.accounts?.oauth2) return;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Impossible de charger Google Identity Services'));
    document.head.appendChild(s);
  });
}

export async function initGoogleAuth(clientId: string): Promise<void> {
  await loadGIS();
  _client = (window as any).google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (resp: any) => {
      if (resp.error) {
        _reject?.(new Error(resp.error_description || resp.error));
      } else {
        const expiry = Date.now() + resp.expires_in * 1000 - 30000;
        localStorage.setItem(KEYS.token, resp.access_token);
        localStorage.setItem(KEYS.expiry, String(expiry));
        _resolve?.(resp.access_token);
      }
      _resolve = _reject = null;
    },
  });
}

export function requestToken(forceConsent = false): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!_client) { reject(new Error('Google Auth non initialisé')); return; }
    _resolve = resolve;
    _reject = reject;
    _client.requestAccessToken({ prompt: forceConsent ? 'consent' : '' });
  });
}

export function getToken(): string | null {
  const token = localStorage.getItem(KEYS.token);
  const expiry = parseInt(localStorage.getItem(KEYS.expiry) || '0');
  return token && Date.now() < expiry ? token : null;
}

export function getStoredSheetId(): string | null {
  return localStorage.getItem(KEYS.sheetId);
}

export function clearAuth(): void {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}

// ─── Sheets API helpers ───────────────────────────────────────────────────────

async function sheetsApi(method: string, url: string, token: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google Sheets API ${res.status}: ${text.slice(0, 200)}`);
  }
  return method === 'DELETE' ? null : res.json();
}

export interface SyncData {
  sales: any[];
  services: any[];
  expenses: any[];
  companyName: string;
}

export async function syncToGoogleSheets(token: string, data: SyncData): Promise<string> {
  const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
  let sheetId = localStorage.getItem(KEYS.sheetId);

  // Verify spreadsheet still accessible
  if (sheetId) {
    try {
      await sheetsApi('GET', `${BASE}/${sheetId}?fields=spreadsheetId`, token);
    } catch {
      sheetId = null;
      localStorage.removeItem(KEYS.sheetId);
    }
  }

  // Create spreadsheet on first sync
  if (!sheetId) {
    const created = await sheetsApi('POST', BASE, token, {
      properties: { title: `${data.companyName} - Base de données` },
      sheets: [
        { properties: { title: 'Ventes', sheetId: 0, index: 0 } },
        { properties: { title: 'Prestations', sheetId: 1, index: 1 } },
        { properties: { title: 'Depenses', sheetId: 2, index: 2 } },
      ],
    });
    sheetId = created.spreadsheetId;
    localStorage.setItem(KEYS.sheetId, sheetId!);
  }

  // Build row data for each sheet
  const salesRows = [
    ['Date', 'Facture', 'Client', 'Article', 'Surface m²', 'Qté', 'Prix/m²', 'Sous-total', 'Remise', 'Total', 'Versé', 'Reste', 'Statut'],
    ...data.sales.map(s => [
      new Date(s.created_at).toLocaleString('fr-FR'),
      s.invoice_number, s.client_name, s.article_name,
      s.surface, s.quantity, s.price_per_sqm, s.subtotal, s.discount, s.total,
      s.amount_paid, +(s.total - s.amount_paid).toFixed(0),
      s.payment_status === 'paid' ? 'Payé' : s.payment_status === 'advance' ? 'Avance' : 'Non payé',
    ]),
  ];

  const serviceRows = [
    ['Date', 'Prestation', 'Client', 'Description', 'Montant FCFA', 'Notes'],
    ...data.services.map(s => [s.service_date, s.name, s.client_name, s.description, s.amount, s.notes]),
  ];

  const expenseRows = [
    ['Date', 'Categorie', 'Description', 'Fournisseur', 'Montant FCFA', 'Notes'],
    ...data.expenses.map(e => [
      e.expense_date,
      e.category === 'achat' ? 'Achat consomm.' : e.category === 'materiel' ? 'Achat materiel' : 'Divers',
      e.name, e.supplier, e.amount, e.notes,
    ]),
  ];

  // Clear existing data then rewrite
  await sheetsApi('POST', `${BASE}/${sheetId}/values:batchClear`, token, {
    ranges: ['Ventes', 'Prestations', 'Depenses'],
  });
  await sheetsApi('POST', `${BASE}/${sheetId}/values:batchUpdate`, token, {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: 'Ventes!A1', values: salesRows },
      { range: 'Prestations!A1', values: serviceRows },
      { range: 'Depenses!A1', values: expenseRows },
    ],
  });

  return sheetId!;
}
