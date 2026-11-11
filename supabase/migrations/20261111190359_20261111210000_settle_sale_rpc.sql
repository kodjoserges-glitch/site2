/*
# Atomic sale settlement RPC

## Description
Creates a SECURITY DEFINER function `settle_sale` that atomically adds a payment
to a sale. This prevents race conditions where two concurrent settles could
overwrite each other's amount_paid.

## New functions
- `settle_sale(p_sale_id uuid, p_added_amount numeric, p_settled_at timestamptz)`
  - Adds `p_added_amount` to `sales.amount_paid` atomically
  - Recomputes `payment_status` from the new total
  - Sets `settled_at` only when the sale becomes fully paid
  - Clamps `amount_paid` to not exceed `total`
  - Returns the updated row

## Security
- SECURITY DEFINER so it can update sales regardless of RLS
- EXECUTE revoked from PUBLIC and anon, granted only to authenticated
- Only the sale owner (seller_id = auth.uid()) or admin/manager can settle
*/

CREATE OR REPLACE FUNCTION settle_sale(
  p_sale_id uuid,
  p_added_amount numeric,
  p_settled_at timestamptz
) RETURNS TABLE(
  id uuid,
  amount_paid numeric,
  payment_status text,
  settled_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_new_amount numeric;
  v_new_status text;
  v_is_authorized boolean;
BEGIN
  SELECT total, amount_paid, seller_id INTO v_sale
  FROM sales WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND status = 'approved'
      AND (role IN ('admin', 'manager') OR id = v_sale.seller_id)
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Not authorized to settle this sale';
  END IF;

  v_new_amount := LEAST(v_sale.amount_paid + p_added_amount, v_sale.total);

  IF v_new_amount >= v_sale.total THEN
    v_new_status := 'paid';
  ELSIF v_new_amount > 0 THEN
    v_new_status := 'advance';
  ELSE
    v_new_status := 'unpaid';
  END IF;

  UPDATE sales
  SET
    amount_paid = v_new_amount,
    payment_status = v_new_status,
    settled_at = CASE WHEN v_new_status = 'paid' THEN COALESCE(p_settled_at, now()) ELSE NULL END,
    updated_at = now()
  WHERE id = p_sale_id;

  RETURN QUERY
  SELECT id, amount_paid, payment_status, settled_at
  FROM sales WHERE id = p_sale_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION settle_sale(uuid, numeric, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION settle_sale(uuid, numeric, timestamptz) TO authenticated;