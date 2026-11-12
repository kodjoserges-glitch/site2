export type PricingType = 'sqm' | 'format';
export type IsoFormat = 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7';

export interface FormatDimensions {
  width: number;  // metres
  height: number; // metres
}

export const ISO_FORMATS: Record<IsoFormat, FormatDimensions> = {
  A0: { width: 0.841, height: 1.189 },
  A1: { width: 0.594, height: 0.841 },
  A2: { width: 0.420, height: 0.594 },
  A3: { width: 0.297, height: 0.420 },
  A4: { width: 0.210, height: 0.297 },
  A5: { width: 0.148, height: 0.210 },
  A6: { width: 0.105, height: 0.148 },
  A7: { width: 0.074, height: 0.105 },
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
  majoration: number;
  majoration_type: 'percentage' | 'fixed';
  total: number;
  amount_paid: number;
  payment_status: 'paid' | 'advance' | 'unpaid';
  notes: string | null;
  pricing_type: PricingType;
  created_at: string;
  settled_at: string | null;
  seller_id: string | null;
  seller_name: string | null;
  print_status: 'pending' | 'printed' | 'reprint_requested';
  printed_at: string | null;
  sale_items?: SaleItem[];
}

export type PaymentStatus = 'paid' | 'advance' | 'unpaid';
export type DiscountType = 'percentage' | 'fixed';
export type MajorationType = 'percentage' | 'fixed';

export type UserRole = 'admin' | 'manager' | 'vendeur' | 'imprimeur';

export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  manager: 'Manager',
  vendeur: 'Vendeur',
  imprimeur: 'Imprimeur',
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

export type NotificationType = 'new_sale' | 'reprint_request' | 'reprint_validated' | 'print_done' | 'office_sale' | 'low_stock';

export interface Notification {
  id: string;
  target_role: UserRole | 'all';
  target_user_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  sale_id: string | null;
  actor_name: string;
  read: boolean;
  created_at: string;
}

// ---- Articles bureautique & consommables ----

export interface OfficeItem {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  unit_price: number;
  cost_price: number;
  stock_quantity: number;
  min_stock: number;
  unit: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type StockMovementType = 'in' | 'out' | 'adjustment';

export interface StockMovement {
  id: string;
  item_id: string;
  movement_type: StockMovementType;
  quantity: number;
  reason: string | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface OfficeSaleItem {
  item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export type OfficePaymentStatus = 'paid' | 'advance' | 'unpaid';

export interface OfficeSale {
  id: string;
  invoice_number: string;
  client_name: string;
  total_amount: number;
  amount_paid: number;
  payment_status: OfficePaymentStatus;
  seller_id: string | null;
  seller_name: string | null;
  items_json: OfficeSaleItem[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}
