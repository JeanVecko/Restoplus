CREATE TABLE IF NOT EXISTS public.stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurantId UUID NOT NULL,
  name VARCHAR(160) NOT NULL,
  unit VARCHAR(30) NOT NULL DEFAULT 'unite',
  quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  threshold DECIMAL(12,3) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'CDF',
  isActive BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS stock_items_restaurant_id_id_key ON public.stock_items (restaurantId, id);
CREATE UNIQUE INDEX IF NOT EXISTS stock_items_restaurant_name_key ON public.stock_items (restaurantId, name);
CREATE INDEX IF NOT EXISTS stock_items_restaurant_active_idx ON public.stock_items (restaurantId, isActive);
ALTER TABLE public.stock_items OWNER TO restoplus_app;
GRANT ALL ON TABLE public.stock_items TO restoplus_app;