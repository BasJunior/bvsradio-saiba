-- BVS beta Marketplace commerce compatibility.
-- The application already resolves published creator listings as creator_product
-- and creator_service. Keep the commerce ledger constraint aligned with those
-- authoritative product types while preserving all existing product types.

alter table public.commerce_products
  drop constraint if exists commerce_products_product_type_check;

alter table public.commerce_products
  add constraint commerce_products_product_type_check
  check (product_type = any (array[
    'single'::text,
    'mix'::text,
    'album'::text,
    'beat'::text,
    'service'::text,
    'creator_product'::text,
    'creator_service'::text
  ]));
