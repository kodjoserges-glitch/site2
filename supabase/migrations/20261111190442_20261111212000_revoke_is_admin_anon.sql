/*
# Revoke EXECUTE on is_admin() from anon

## Description
The `is_admin()` SECURITY DEFINER function was callable by every role including anon.
This revokes EXECUTE from PUBLIC and anon, and grants only to authenticated.

## Security
- is_admin() reads the caller's profile role — low impact, but follows the principle
  of least privilege for SECURITY DEFINER functions.
*/

REVOKE EXECUTE ON FUNCTION is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;