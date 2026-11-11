/*
# Restrict print queue deletion to administrators and managers

## Description
This migration limits deletion of sales from the print queue to users whose approved profile role is `admin` or `manager`.
The print queue uses the `sales` table, so deleting a sale also removes its related sale items and notifications through the existing cascade rules.

## Modified tables
- `sales`: replace the broad authenticated DELETE policy with a role-checked policy.

## Security
- Administrators and managers can delete sales.
- Vendeurs and imprimeurs cannot delete sales, even if they bypass the visible interface and send a direct database request.
- Existing SELECT, INSERT, and UPDATE access remains unchanged.

## Important notes
1. The role check reads from `user_profiles` using the authenticated user's ID.
2. The UI will only display the delete action to administrators and managers, but the database policy is the authoritative protection.
*/

DROP POLICY IF EXISTS "delete_sales" ON sales;

CREATE POLICY "delete_sales_admin_manager"
ON sales
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'manager')
      AND user_profiles.status = 'approved'
  )
);