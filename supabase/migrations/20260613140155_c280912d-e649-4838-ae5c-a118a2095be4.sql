
-- Extend deal status enum with partial/full funding states
ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'partially_funded';
ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'fully_funded';

-- Deals: add minimum ticket + running funded total
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS min_investment numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS funded_amount numeric NOT NULL DEFAULT 0;

-- Investment status enum
DO $$ BEGIN
  CREATE TYPE public.investment_status AS ENUM ('funds_in_escrow','equity_confirmed','completed','disputed','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Investments table
CREATE TABLE IF NOT EXISTS public.investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  equity_percent numeric NOT NULL CHECK (equity_percent > 0),
  status public.investment_status NOT NULL DEFAULT 'funds_in_escrow',
  sme_confirmed_equity boolean NOT NULL DEFAULT false,
  investor_confirmed_receipt boolean NOT NULL DEFAULT false,
  platform_fee numeric NOT NULL DEFAULT 0,
  dispute_reason text,
  funded_at timestamptz NOT NULL DEFAULT now(),
  deadline timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investments TO authenticated;
GRANT ALL ON public.investments TO service_role;

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

-- Admin can do anything
CREATE POLICY "investments admin all" ON public.investments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Investor: read & update own investments, insert with self as investor_id
CREATE POLICY "investments investor read own" ON public.investments
  FOR SELECT TO authenticated
  USING (investor_id = auth.uid());

CREATE POLICY "investments investor insert self" ON public.investments
  FOR INSERT TO authenticated
  WITH CHECK (investor_id = auth.uid() AND public.has_role(auth.uid(), 'investor'));

CREATE POLICY "investments investor update own" ON public.investments
  FOR UPDATE TO authenticated
  USING (investor_id = auth.uid())
  WITH CHECK (investor_id = auth.uid());

-- SME: read & update investments on their own deals
CREATE POLICY "investments sme read on own deals" ON public.investments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id AND d.sme_id = auth.uid()));

CREATE POLICY "investments sme update on own deals" ON public.investments
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id AND d.sme_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id AND d.sme_id = auth.uid()));

-- Validation + funded_amount maintenance
CREATE OR REPLACE FUNCTION public.investments_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  NEW.equity_percent := (NEW.amount / d.amount_requested) * d.equity_offered;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.investments_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.deals%ROWTYPE; new_total numeric;
BEGIN
  UPDATE public.deals SET funded_amount = funded_amount + NEW.amount WHERE id = NEW.deal_id
    RETURNING * INTO d;
  IF d.funded_amount >= d.amount_requested THEN
    UPDATE public.deals SET status = 'fully_funded' WHERE id = NEW.deal_id;
  ELSE
    UPDATE public.deals SET status = 'partially_funded' WHERE id = NEW.deal_id AND status = 'approved';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_investments_before_insert ON public.investments;
CREATE TRIGGER trg_investments_before_insert
  BEFORE INSERT ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.investments_before_insert();

DROP TRIGGER IF EXISTS trg_investments_after_insert ON public.investments;
CREATE TRIGGER trg_investments_after_insert
  AFTER INSERT ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.investments_after_insert();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_investments_updated_at ON public.investments;
CREATE TRIGGER trg_investments_updated_at
  BEFORE UPDATE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- When all investments completed, mark deal completed
CREATE OR REPLACE FUNCTION public.investments_after_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE remaining int; d_status public.deal_status;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  SELECT status INTO d_status FROM public.deals WHERE id = NEW.deal_id;

  IF NEW.status = 'disputed' THEN
    UPDATE public.deals SET status = 'disputed' WHERE id = NEW.deal_id;
  ELSIF NEW.status = 'completed' THEN
    SELECT count(*) INTO remaining FROM public.investments
      WHERE deal_id = NEW.deal_id AND status <> 'completed';
    IF remaining = 0 AND d_status = 'fully_funded' THEN
      UPDATE public.deals SET status = 'completed' WHERE id = NEW.deal_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_investments_after_update ON public.investments;
CREATE TRIGGER trg_investments_after_update
  AFTER UPDATE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.investments_after_update();

-- Default min_investment to 25% for existing approved deals where 0
UPDATE public.deals SET min_investment = GREATEST(round(amount_requested * 0.25), 1)
  WHERE min_investment = 0;
