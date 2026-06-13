
-- Roles
CREATE TYPE public.app_role AS ENUM ('sme', 'investor', 'admin');
CREATE TYPE public.deal_status AS ENUM ('draft','under_review','approved','rejected','funds_in_escrow','equity_confirmed','completed','refunded','disputed');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'sme',
  wallet_balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- has_role security definer (must exist before policies use it)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role)
$$;

CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles admin all" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Trigger to auto-create profile on signup, reading role + name from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, wallet_balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'sme'),
    CASE WHEN COALESCE(NEW.raw_user_meta_data->>'role','') = 'investor' THEN 500000 ELSE 0 END
  );
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Deals
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sme_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  sme_name TEXT NOT NULL,
  sector TEXT NOT NULL,
  country TEXT NOT NULL,
  years_in_operation INTEGER NOT NULL DEFAULT 0,
  amount_requested NUMERIC NOT NULL,
  equity_offered NUMERIC NOT NULL,
  use_of_funds TEXT NOT NULL DEFAULT '',
  pitch TEXT NOT NULL DEFAULT '',
  revenue NUMERIC NOT NULL DEFAULT 0,
  net_profit NUMERIC NOT NULL DEFAULT 0,
  total_assets NUMERIC NOT NULL DEFAULT 0,
  interest_bearing_debt NUMERIC NOT NULL DEFAULT 0,
  interest_income NUMERIC NOT NULL DEFAULT 0,
  bank_statements_file TEXT,
  financial_statements_file TEXT,
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  shariah_status TEXT NOT NULL DEFAULT 'pending',
  status public.deal_status NOT NULL DEFAULT 'under_review',
  reviewed_by UUID REFERENCES auth.users,
  review_note TEXT,
  investor_id UUID REFERENCES auth.users,
  platform_fee NUMERIC NOT NULL DEFAULT 0,
  sme_confirmed_equity BOOLEAN NOT NULL DEFAULT false,
  investor_confirmed_receipt BOOLEAN NOT NULL DEFAULT false,
  deadline TIMESTAMPTZ,
  funded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- SMEs read/write their own; investors read approved + ones they funded and update funded ones; admins everything
CREATE POLICY "deals sme own" ON public.deals FOR ALL TO authenticated
  USING (auth.uid() = sme_id) WITH CHECK (auth.uid() = sme_id);
CREATE POLICY "deals investor read approved" ON public.deals FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'investor') AND (status = 'approved' OR investor_id = auth.uid())
  );
CREATE POLICY "deals investor update own funded" ON public.deals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'investor') AND (investor_id = auth.uid() OR (investor_id IS NULL AND status = 'approved')))
  WITH CHECK (public.has_role(auth.uid(),'investor'));
CREATE POLICY "deals admin all" ON public.deals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX deals_status_idx ON public.deals(status);
CREATE INDEX deals_sme_idx ON public.deals(sme_id);
CREATE INDEX deals_investor_idx ON public.deals(investor_id);
