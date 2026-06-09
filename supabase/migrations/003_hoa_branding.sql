-- Add branding and location fields to hoas table
alter table hoas
  add column if not exists logo_url  text,
  add column if not exists city      text,
  add column if not exists state     text not null default 'FL',
  add column if not exists website   text,
  add column if not exists phone     text;
