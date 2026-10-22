-- Resto+ — Catalogue persistant multi-restaurant.
-- Candidat destiné exclusivement à restoplus_test_disposable; non exécuté.
-- Exécutant prévu : restoplus_migrator après les prérequis des migrations précédentes.

DO $$
BEGIN
    IF current_database() <> 'restoplus_test_disposable' THEN
        RAISE EXCEPTION 'SÉCURITÉ: migration Catalogue autorisée uniquement sur restoplus_test_disposable (base actuelle: %)', current_database();
    END IF;
END $$;

CREATE TYPE "public"."menu_preparation_station" AS ENUM ('CUISINE', 'BAR');
CREATE TYPE "public"."menu_zone" AS ENUM ('STANDARD', 'TERRACE', 'VIP');
CREATE TYPE "public"."menu_product_option_kind" AS ENUM ('INCLUDED', 'PAID');

CREATE TABLE "public"."menu_categories" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "menu_categories_restaurant_id_id_key" UNIQUE ("restaurantId", "id"),
    CONSTRAINT "menu_categories_name_check" CHECK (length(btrim("name")) > 0),
    CONSTRAINT "menu_categories_display_order_check" CHECK ("displayOrder" >= 0),
    CONSTRAINT "menu_categories_restaurant_fkey" FOREIGN KEY ("restaurantId")
        REFERENCES "public"."restaurants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "menu_categories_restaurant_active_order_idx"
    ON "public"."menu_categories" ("restaurantId", "isActive", "displayOrder");

CREATE TABLE "public"."menu_products" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(1000),
    "preparationStation" "public"."menu_preparation_station" NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "standardPriceAmount" DECIMAL(12, 2) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isDailySpecial" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "menu_products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "menu_products_restaurant_id_id_key" UNIQUE ("restaurantId", "id"),
    CONSTRAINT "menu_products_restaurant_id_currency_key" UNIQUE ("restaurantId", "id", "currency"),
    CONSTRAINT "menu_products_name_check" CHECK (length(btrim("name")) > 0),
    CONSTRAINT "menu_products_currency_check" CHECK ("currency" IN ('CDF', 'USD')),
    CONSTRAINT "menu_products_standard_price_check" CHECK ("standardPriceAmount" >= 0),
    CONSTRAINT "menu_products_display_order_check" CHECK ("displayOrder" >= 0),
    CONSTRAINT "menu_products_restaurant_fkey" FOREIGN KEY ("restaurantId")
        REFERENCES "public"."restaurants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "menu_products_category_fkey" FOREIGN KEY ("restaurantId", "categoryId")
        REFERENCES "public"."menu_categories" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "menu_products_restaurant_category_order_idx"
    ON "public"."menu_products" ("restaurantId", "categoryId", "isActive", "displayOrder");
CREATE INDEX "menu_products_restaurant_active_available_idx"
    ON "public"."menu_products" ("restaurantId", "isActive", "isAvailable");

CREATE TABLE "public"."menu_product_variants" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "standardPriceAmount" DECIMAL(12, 2) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "menu_product_variants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "menu_product_variants_restaurant_id_id_key" UNIQUE ("restaurantId", "id"),
    CONSTRAINT "menu_product_variants_restaurant_product_id_key" UNIQUE ("restaurantId", "productId", "id"),
    CONSTRAINT "menu_product_variants_name_check" CHECK (length(btrim("name")) > 0),
    CONSTRAINT "menu_product_variants_standard_price_check" CHECK ("standardPriceAmount" >= 0),
    CONSTRAINT "menu_product_variants_display_order_check" CHECK ("displayOrder" >= 0),
    CONSTRAINT "menu_product_variants_restaurant_fkey" FOREIGN KEY ("restaurantId")
        REFERENCES "public"."restaurants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "menu_product_variants_product_fkey" FOREIGN KEY ("restaurantId", "productId")
        REFERENCES "public"."menu_products" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "menu_product_variants_product_order_idx"
    ON "public"."menu_product_variants" ("restaurantId", "productId", "isActive", "displayOrder");

CREATE TABLE "public"."menu_product_options" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "kind" "public"."menu_product_option_kind" NOT NULL,
    "priceAmount" DECIMAL(12, 2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "menu_product_options_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "menu_product_options_restaurant_id_id_key" UNIQUE ("restaurantId", "id"),
    CONSTRAINT "menu_product_options_name_check" CHECK (length(btrim("name")) > 0),
    CONSTRAINT "menu_product_options_currency_check" CHECK ("currency" IN ('CDF', 'USD')),
    CONSTRAINT "menu_product_options_price_kind_check" CHECK (
        ("kind" = 'INCLUDED'::"public"."menu_product_option_kind" AND "priceAmount" = 0)
        OR ("kind" = 'PAID'::"public"."menu_product_option_kind" AND "priceAmount" > 0)
    ),
    CONSTRAINT "menu_product_options_display_order_check" CHECK ("displayOrder" >= 0),
    CONSTRAINT "menu_product_options_restaurant_fkey" FOREIGN KEY ("restaurantId")
        REFERENCES "public"."restaurants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "menu_product_options_product_currency_fkey" FOREIGN KEY ("restaurantId", "productId", "currency")
        REFERENCES "public"."menu_products" ("restaurantId", "id", "currency") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "menu_product_options_product_active_idx"
    ON "public"."menu_product_options" ("restaurantId", "productId", "isActive", "isAvailable");

CREATE TABLE "public"."menu_product_zone_prices" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "variantId" UUID,
    "zone" "public"."menu_zone" NOT NULL,
    "priceAmount" DECIMAL(12, 2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "menu_product_zone_prices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "menu_product_zone_prices_restaurant_id_id_key" UNIQUE ("restaurantId", "id"),
    CONSTRAINT "menu_product_zone_prices_non_standard_zone_check" CHECK ("zone" <> 'STANDARD'::"public"."menu_zone"),
    CONSTRAINT "menu_product_zone_prices_amount_check" CHECK ("priceAmount" >= 0),
    CONSTRAINT "menu_product_zone_prices_restaurant_fkey" FOREIGN KEY ("restaurantId")
        REFERENCES "public"."restaurants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "menu_product_zone_prices_product_fkey" FOREIGN KEY ("restaurantId", "productId")
        REFERENCES "public"."menu_products" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "menu_product_zone_prices_variant_fkey" FOREIGN KEY ("restaurantId", "productId", "variantId")
        REFERENCES "public"."menu_product_variants" ("restaurantId", "productId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- PostgreSQL unique indexes treat NULLs as distinct by default. These two
-- partial indexes enforce one active or inactive row per target and zone;
-- services reactivate/update the row instead of physically deleting it.
CREATE UNIQUE INDEX "menu_product_zone_prices_product_zone_key"
    ON "public"."menu_product_zone_prices" ("restaurantId", "productId", "zone")
    WHERE "variantId" IS NULL;
CREATE UNIQUE INDEX "menu_product_zone_prices_variant_zone_key"
    ON "public"."menu_product_zone_prices" ("restaurantId", "productId", "variantId", "zone")
    WHERE "variantId" IS NOT NULL;
CREATE INDEX "menu_product_zone_prices_product_lookup_idx"
    ON "public"."menu_product_zone_prices" ("restaurantId", "productId", "zone", "isActive");
CREATE INDEX "menu_product_zone_prices_variant_lookup_idx"
    ON "public"."menu_product_zone_prices" ("restaurantId", "productId", "variantId", "zone", "isActive");

-- Orders retain name/price/currency/station snapshots. This records the
-- requested zone without changing existing order snapshots or totals.
ALTER TABLE "public"."orders"
    ADD COLUMN "pricingZone" "public"."menu_zone" NOT NULL DEFAULT 'STANDARD';

REVOKE ALL PRIVILEGES ON "public"."menu_categories", "public"."menu_products",
    "public"."menu_product_variants", "public"."menu_product_options",
    "public"."menu_product_zone_prices"
    FROM PUBLIC, restoplus_app, restoplus_auth, restoplus_bootstrap_owner, restoplus_account_ops;
REVOKE ALL PRIVILEGES ON TYPE "public"."menu_preparation_station", "public"."menu_zone",
    "public"."menu_product_option_kind"
    FROM PUBLIC, restoplus_app, restoplus_auth, restoplus_bootstrap_owner, restoplus_account_ops;
GRANT USAGE ON TYPE "public"."menu_preparation_station", "public"."menu_zone",
    "public"."menu_product_option_kind" TO restoplus_app;

ALTER TABLE "public"."menu_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."menu_categories" FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."menu_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."menu_products" FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."menu_product_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."menu_product_variants" FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."menu_product_options" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."menu_product_options" FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."menu_product_zone_prices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."menu_product_zone_prices" FORCE ROW LEVEL SECURITY;

CREATE POLICY "menu_categories_tenant_isolation" ON "public"."menu_categories"
    FOR ALL TO restoplus_app
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid)
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "menu_products_tenant_isolation" ON "public"."menu_products"
    FOR ALL TO restoplus_app
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid)
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "menu_product_variants_tenant_isolation" ON "public"."menu_product_variants"
    FOR ALL TO restoplus_app
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid)
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "menu_product_options_tenant_isolation" ON "public"."menu_product_options"
    FOR ALL TO restoplus_app
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid)
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "menu_product_zone_prices_tenant_isolation" ON "public"."menu_product_zone_prices"
    FOR ALL TO restoplus_app
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid)
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON "public"."menu_categories" TO restoplus_app;
GRANT SELECT, INSERT, UPDATE ON "public"."menu_products" TO restoplus_app;
GRANT SELECT, INSERT, UPDATE ON "public"."menu_product_variants" TO restoplus_app;
GRANT SELECT, INSERT, UPDATE ON "public"."menu_product_options" TO restoplus_app;
GRANT SELECT, INSERT, UPDATE ON "public"."menu_product_zone_prices" TO restoplus_app;

