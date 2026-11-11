/*
# Add performance indexes and fix dead surfaceCm2 field

## Description
1. Adds indexes on frequently queried columns to improve performance as data grows.
2. No schema changes to columns — indexes only.

## New indexes
- `sales_created_at_idx` on `sales(created_at)` — used by history and daily recap date filters
- `sales_seller_id_idx` on `sales(seller_id)` — used by DailyRecap per-vendeur filtering
- `sales_print_status_idx` on `sales(print_status)` — used by PrintQueue filtering
- `sale_items_sale_id_idx` on `sale_items(sale_id)` — used by join queries
- `notifications_target_role_idx` on `notifications(target_role)` — used by role-based notification queries
- `services_service_date_idx` on `services(service_date)` — used by date range queries
- `expenses_expense_date_idx` on `expenses(expense_date)` — used by date range queries

## Security
- No RLS or policy changes.
*/

CREATE INDEX IF NOT EXISTS sales_created_at_idx ON sales(created_at);
CREATE INDEX IF NOT EXISTS sales_seller_id_idx ON sales(seller_id);
CREATE INDEX IF NOT EXISTS sales_print_status_idx ON sales(print_status);
CREATE INDEX IF NOT EXISTS sale_items_sale_id_idx ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS notifications_target_role_idx ON notifications(target_role);
CREATE INDEX IF NOT EXISTS services_service_date_idx ON services(service_date);
CREATE INDEX IF NOT EXISTS expenses_expense_date_idx ON expenses(expense_date);