export type PricingType = 'sqm' | 'format';
export type IsoFormat = 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7';

export interface FormatDimensions {
  width: number;  // metres
  height: number; // metres
  surfaceCm2: number;
}

export const ISO_FORMATS: Record<IsoFormat, FormatDimensions> = {
  A0: { width: 0.841, height: 1.189, surfaceCm2: 8410 * 11890 / 10000 },
  A1: { width: 0.594, height: 0.841, surfaceCm2: 5940 * 8410 / 10000 },
  A2: { width: 0.420, height: 0.594, surfaceCm2: 4200 * 5940 / 10000 },
  A3: { width: 0.297, height: 0.420, surfaceCm2: 2970 * 4200 / 10000 },
  A4: { width: 0.210, height: 0.297, surfaceCm2: 2100 * 2970 / 10000 },
  A5: { width: 0.148, height: 0.210, surfaceCm2: 1480 * 2100 / 10000 },
  A6: { width: 0.105, height: 0.148, surfaceCm2: 1050 * 1480 / 10000 },
  A7: { width: 0.074, height: 0.105, surfaceCm2: 740 * 1050 / 10000 },
};

export type ExpenseCategory = 'achat' | 'divers';

export interface Service {
  id: string;
  name: string;
  description: string;
  amount: number;
  service_date: string;
  client_name: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  category: ExpenseCategory;
  name: string;
  amount: number;
  expense_date: string;
  supplier: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: string;
  name: string;
  pricing_type: PricingType;
  price_per_sqm: number;
  price_per_unit: number | null;
  format: IsoFormat | null;
  unit: string;
  category_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  article_id: string | null;
  article_name: string;
  pricing_type: PricingType;
  width: number;
  length: number;
  surface: number;
  quantity: number;
  price_per_sqm: number;
  subtotal: number;
  created_at: string;
}

export interface Sale {
  id: string;
  invoice_number: string;
  client_name: string;
  article_id: string;
  article_name: string;
  width: number;
  length: number;
  surface: number;
  quantity: number;
  price_per_sqm: number;
  subtotal: number;
  discount: number;
  discount_type: 'percentage' | 'fixed';
  total: number;
  amount_paid: number;
  payment_status: 'paid' | 'advance' | 'unpaid';
  notes: string | null;
  pricing_type: PricingType;
  created_at: string;
  sale_items?: SaleItem[];
}

export type PaymentStatus = 'paid' | 'advance' | 'unpaid';
export type DiscountType = 'percentage' | 'fixed';

export type UserRole = 'admin' | 'manager' | 'vendeur';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  manager: 'Manager',
  vendeur: 'Vendeur',
};

export interface CompanyProfile {
  id: string;
  company_name: string;
  slogan: string;
  logo_url: string | null;
  phone: string;
  email: string;
  address: string;
  website: string;
  invoice_footer: string;
  primary_color: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
