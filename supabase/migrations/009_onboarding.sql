-- Add onboarding tracking to profiles
-- New admins start with false; wizard completion sets it to true

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;
