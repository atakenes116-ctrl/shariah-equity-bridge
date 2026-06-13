
CREATE OR REPLACE FUNCTION public.user_has_investment_in_deal(_deal_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.investments
    WHERE deal_id = _deal_id AND investor_id = _user_id
  )
$$;

DROP POLICY IF EXISTS "deals investor read invested" ON public.deals;

CREATE POLICY "deals investor read invested"
ON public.deals
FOR SELECT
TO authenticated
USING (public.user_has_investment_in_deal(id, auth.uid()));
