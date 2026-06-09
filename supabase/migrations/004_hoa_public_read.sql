-- Allow anyone (including unauthenticated visitors) to read basic HOA info.
-- This is needed for the public per-HOA portal landing page.
-- HOA data (name, address, city, subdomain) is intentionally public — it's the
-- same info posted on the building entrance.
create policy "Anyone can read HOA public info"
  on hoas for select
  using (true);
