
-- Allow investors to read deals they have invested in (any status)
CREATE POLICY "deals investor read invested"
ON public.deals FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.investments i
    WHERE i.deal_id = deals.id AND i.investor_id = auth.uid()
  )
);

-- Broaden the marketplace read policy to include partially_funded / fully_funded
DROP POLICY IF EXISTS "deals investor read approved" ON public.deals;
CREATE POLICY "deals investor read open"
ON public.deals FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'investor'::public.app_role)
  AND status IN ('approved'::public.deal_status, 'partially_funded'::public.deal_status, 'fully_funded'::public.deal_status)
);
