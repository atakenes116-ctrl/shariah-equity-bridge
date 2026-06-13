
-- 1. Deal type enum
DO $$ BEGIN
  CREATE TYPE public.deal_type AS ENUM ('musharakah', 'murabaha');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Deals: deal_type + Murabaha-specific columns, loosen equity_offered
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS deal_type public.deal_type NOT NULL DEFAULT 'musharakah',
  ADD COLUMN IF NOT EXISTS asset_name text,
  ADD COLUMN IF NOT EXISTS asset_description text,
  ADD COLUMN IF NOT EXISTS asset_supplier text,
  ADD COLUMN IF NOT EXISTS tenor_months integer,
  ADD COLUMN IF NOT EXISTS profit_rate numeric,
  ADD COLUMN IF NOT EXISTS total_repayable numeric;

ALTER TABLE public.deals ALTER COLUMN equity_offered DROP NOT NULL;

-- 3. Investments: share_percent (pro-rata claim), loosen equity_percent
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS share_percent numeric;

ALTER TABLE public.investments ALTER COLUMN equity_percent DROP NOT NULL;
ALTER TABLE public.investments DROP CONSTRAINT IF EXISTS investments_equity_percent_check;
-- backfill share_percent from equity_percent on existing rows
UPDATE public.investments SET share_percent = equity_percent WHERE share_percent IS NULL;

-- 4. Replace investments_before_insert to support both deal types
CREATE OR REPLACE FUNCTION public.investments_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE d public.deals%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.deals WHERE id = NEW.deal_id FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF d.status NOT IN ('approved','partially_funded') THEN
    RAISE EXCEPTION 'Deal is not open for funding (status=%)', d.status;
  END IF;
  IF NEW.amount < d.min_investment THEN
    RAISE EXCEPTION 'Amount below minimum ticket of %', d.min_investment;
  END IF;
  IF d.funded_amount + NEW.amount > d.amount_requested THEN
    RAISE EXCEPTION 'Amount exceeds remaining capacity';
  END IF;
  NEW.share_percent := (NEW.amount / d.amount_requested) * 100;
  IF d.deal_type = 'musharakah' THEN
    NEW.equity_percent := (NEW.amount / d.amount_requested) * COALESCE(d.equity_offered, 0);
  ELSE
    NEW.equity_percent := NULL;
  END IF;
  RETURN NEW;
END $$;

-- 5. Installments table
CREATE TABLE IF NOT EXISTS public.installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  due_date date NOT NULL,
  total_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'due',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, seq)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.installments TO authenticated;
GRANT ALL ON public.installments TO service_role;

ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "installments admin all" ON public.installments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "installments sme read own" ON public.installments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = installments.deal_id AND d.sme_id = auth.uid()));

CREATE POLICY "installments sme update own" ON public.installments
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = installments.deal_id AND d.sme_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = installments.deal_id AND d.sme_id = auth.uid()));

CREATE POLICY "installments investor read invested" ON public.installments
  FOR SELECT TO authenticated
  USING (public.user_has_investment_in_deal(deal_id, auth.uid()));

CREATE INDEX IF NOT EXISTS installments_deal_idx ON public.installments(deal_id);

CREATE TRIGGER trg_installments_updated_at
BEFORE UPDATE ON public.installments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. Generate installments when Murabaha deal becomes fully_funded
CREATE OR REPLACE FUNCTION public.deals_after_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i integer;
  monthly numeric;
  total numeric;
BEGIN
  IF NEW.status = 'fully_funded' AND OLD.status <> 'fully_funded'
     AND NEW.deal_type = 'murabaha' AND NEW.tenor_months IS NOT NULL THEN
    total := COALESCE(NEW.total_repayable, NEW.amount_requested);
    monthly := round((total / NEW.tenor_months)::numeric, 2);
    FOR i IN 1..NEW.tenor_months LOOP
      INSERT INTO public.installments(deal_id, seq, due_date, total_amount)
      VALUES (
        NEW.id, i,
        (now() + (i || ' months')::interval)::date,
        CASE WHEN i = NEW.tenor_months
             THEN total - monthly * (NEW.tenor_months - 1)
             ELSE monthly END
      )
      ON CONFLICT (deal_id, seq) DO NOTHING;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_deals_after_status_change ON public.deals;
CREATE TRIGGER trg_deals_after_status_change
AFTER UPDATE OF status ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.deals_after_status_change();

-- 7. Mark Murabaha deal completed once every installment is paid
CREATE OR REPLACE FUNCTION public.installments_after_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE remaining int;
BEGIN
  IF NEW.status = 'paid' AND OLD.status <> 'paid' THEN
    SELECT count(*) INTO remaining FROM public.installments
      WHERE deal_id = NEW.deal_id AND status <> 'paid';
    IF remaining = 0 THEN
      UPDATE public.deals SET status = 'completed' WHERE id = NEW.deal_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_installments_after_update ON public.installments;
CREATE TRIGGER trg_installments_after_update
AFTER UPDATE OF status ON public.installments
FOR EACH ROW EXECUTE FUNCTION public.installments_after_update();
