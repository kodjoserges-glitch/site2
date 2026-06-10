-- Company settings table for template customization
CREATE TABLE company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'LXD PRINT',
  slogan text DEFAULT '',
  logo_url text,
  phone text DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  website text DEFAULT '',
  invoice_footer text DEFAULT 'Merci pour votre confiance !',
  primary_color text DEFAULT '#2563eb',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "select_company_settings" ON company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_company_settings" ON company_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_company_settings" ON company_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_company_settings" ON company_settings FOR DELETE TO authenticated USING (true);

-- Insert default settings
INSERT INTO company_settings (company_name, slogan, phone, email, address, website)
VALUES ('LXD PRINT', 'Solutions d''impression professionnelle', '+225 XX XX XX XX', 'contact@lxdprint.com', 'Abidjan, Cote d''Ivoire', 'www.lxdprint.com');