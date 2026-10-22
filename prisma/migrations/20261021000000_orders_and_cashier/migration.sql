-- ==============================================================================
-- Resto+ — Migration 2 : Commandes, Bons Cuisine/Bar, Reçus, Encaissements et Audit
-- Cible de cette recette : restoplus_test_disposable uniquement.
-- Exécutant attendu : restoplus_migrator
-- Isolation stricte multi-restaurant Row Level Security (RLS) forcée
-- ==============================================================================

-- Prisma Migrate lit du SQL brut : aucune méta-commande psql n'est permise.
-- Garde-fou de cette recette : une autre base exige une révision explicite.
DO $$
BEGIN
    IF current_database() <> 'restoplus_test_disposable' THEN
        RAISE EXCEPTION 'SÉCURITÉ: migration Commandes autorisée uniquement sur restoplus_test_disposable (base actuelle: %)', current_database();
    END IF;
END $$;

-- 1. Types énumérés pour les Commandes et l'Encaissement
-- -----------------------------------------------------

CREATE TYPE "public"."order_status" AS ENUM (
    'WAITING_CASHIER',
    'IN_PREPARATION',
    'READY',
    'COMPLETED',
    'CANCELLED'
);

CREATE TYPE "public"."order_station" AS ENUM (
    'CUISINE',
    'BAR'
);

CREATE TYPE "public"."ticket_status" AS ENUM (
    'PENDING',
    'IN_PREPARATION',
    'READY'
);

CREATE TYPE "public"."payment_method" AS ENUM (
    'CASH_CDF',
    'CASH_USD',
    'MPESA',
    'ORANGE_MONEY',
    'AIRTEL_MONEY',
    'CARD'
);

-- 2. Tables métier
-- ----------------

-- Tables de salle (Dining Tables)
CREATE TABLE "public"."dining_tables" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "tableNumber" VARCHAR(30) NOT NULL,
    "zone" VARCHAR(30) NOT NULL DEFAULT 'STANDARD',
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "status" VARCHAR(30) NOT NULL DEFAULT 'FREE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "dining_tables_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "dining_tables_restaurant_id_id_key" UNIQUE ("restaurantId", "id"),
    CONSTRAINT "dining_tables_restaurant_number_key" UNIQUE ("restaurantId", "tableNumber"),
    CONSTRAINT "dining_tables_restaurantId_fkey" FOREIGN KEY ("restaurantId")
        REFERENCES "public"."restaurants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Commandes (Orders)
CREATE TABLE "public"."orders" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "orderNumber" VARCHAR(32) NOT NULL,
    "tableId" UUID,
    "tableName" VARCHAR(60) NOT NULL,
    "serverUserId" UUID NOT NULL,
    "status" "public"."order_status" NOT NULL DEFAULT 'WAITING_CASHIER',
    "coversCount" INTEGER NOT NULL DEFAULT 1,
    "isTakeaway" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "cashierValidatedAt" TIMESTAMPTZ(3),
    "cashierUserId" UUID,
    "cancelledAt" TIMESTAMPTZ(3),
    "cancellationReason" TEXT,
    "cancelledByUserId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "orders_restaurant_id_id_key" UNIQUE ("restaurantId", "id"),
    CONSTRAINT "orders_restaurant_order_number_key" UNIQUE ("restaurantId", "orderNumber"),
    CONSTRAINT "orders_covers_count_check" CHECK ("coversCount" BETWEEN 1 AND 50),
    CONSTRAINT "orders_cashier_validation_consistency_check" CHECK (
        ("cashierValidatedAt" IS NULL AND "cashierUserId" IS NULL)
        OR ("cashierValidatedAt" IS NOT NULL AND "cashierUserId" IS NOT NULL)
    ),
    CONSTRAINT "orders_cancellation_consistency_check" CHECK (
        ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL
            AND "cancelledByUserId" IS NOT NULL
            AND "cancellationReason" IS NOT NULL
            AND length(btrim("cancellationReason")) > 0)
        OR ("status" <> 'CANCELLED' AND "cancelledAt" IS NULL
            AND "cancelledByUserId" IS NULL AND "cancellationReason" IS NULL)
    ),
    CONSTRAINT "orders_restaurantId_fkey" FOREIGN KEY ("restaurantId")
        REFERENCES "public"."restaurants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "orders_table_fkey" FOREIGN KEY ("restaurantId", "tableId")
        REFERENCES "public"."dining_tables" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "orders_server_user_fkey" FOREIGN KEY ("restaurantId", "serverUserId")
        REFERENCES "public"."users" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "orders_cashier_user_fkey" FOREIGN KEY ("restaurantId", "cashierUserId")
        REFERENCES "public"."users" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "orders_cancelled_by_user_fkey" FOREIGN KEY ("restaurantId", "cancelledByUserId")
        REFERENCES "public"."users" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "orders_restaurant_status_created_idx"
    ON "public"."orders" ("restaurantId", "status", "createdAt");

-- Lignes de commandes (Order Lines)
CREATE TABLE "public"."order_lines" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" VARCHAR(64) NOT NULL,
    "productName" VARCHAR(160) NOT NULL,
    "station" "public"."order_station" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceAmount" DECIMAL(12, 2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "selectedAccompaniments" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "selectedExtras" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "notes" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_lines_restaurant_id_id_key" UNIQUE ("restaurantId", "id"),
    CONSTRAINT "order_lines_restaurantId_fkey" FOREIGN KEY ("restaurantId")
        REFERENCES "public"."restaurants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "order_lines_restaurant_order_fkey" FOREIGN KEY ("restaurantId", "orderId")
        REFERENCES "public"."orders" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "order_lines_unit_price_nonnegative_check" CHECK ("unitPriceAmount" >= 0),
    CONSTRAINT "order_lines_quantity_check" CHECK ("quantity" BETWEEN 1 AND 99),
    CONSTRAINT "order_lines_currency_check" CHECK ("currency" IN ('CDF', 'USD'))
);

CREATE INDEX "order_lines_restaurant_order_idx"
    ON "public"."order_lines" ("restaurantId", "orderId");

-- Bons Cuisine et Bar (Kitchen & Bar Tickets)
CREATE TABLE "public"."kitchen_bar_tickets" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "ticketNumber" VARCHAR(36) NOT NULL,
    "station" "public"."order_station" NOT NULL,
    "status" "public"."ticket_status" NOT NULL DEFAULT 'PENDING',
    "itemsSummary" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMPTZ(3),
    "handledByUserId" UUID,
    CONSTRAINT "kitchen_bar_tickets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "kitchen_bar_tickets_restaurant_id_id_key" UNIQUE ("restaurantId", "id"),
    CONSTRAINT "kitchen_bar_tickets_restaurant_ticket_number_key" UNIQUE ("restaurantId", "ticketNumber"),
    CONSTRAINT "kitchen_bar_tickets_restaurant_order_station_key" UNIQUE ("restaurantId", "orderId", "station"),
    CONSTRAINT "kitchen_bar_tickets_ready_consistency_check" CHECK (
        ("status" = 'READY' AND "readyAt" IS NOT NULL)
        OR ("status" <> 'READY' AND "readyAt" IS NULL)
    ),
    CONSTRAINT "kitchen_bar_tickets_restaurantId_fkey" FOREIGN KEY ("restaurantId")
        REFERENCES "public"."restaurants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "kitchen_bar_tickets_restaurant_order_fkey" FOREIGN KEY ("restaurantId", "orderId")
        REFERENCES "public"."orders" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "kitchen_bar_tickets_handled_by_user_fkey" FOREIGN KEY ("restaurantId", "handledByUserId")
        REFERENCES "public"."users" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "kitchen_bar_tickets_restaurant_station_status_idx"
    ON "public"."kitchen_bar_tickets" ("restaurantId", "station", "status");

-- Reçus de caisse (Receipts)
CREATE TABLE "public"."receipts" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "receiptNumber" VARCHAR(32) NOT NULL,
    "discountAmount" DECIMAL(12, 2),
    "discountCurrency" VARCHAR(3),
    "discountReason" TEXT,
    "discountAuthorizedByUserId" UUID,
    "isSettled" BOOLEAN NOT NULL DEFAULT false,
    "cashierUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMPTZ(3),
    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "receipts_order_id_key" UNIQUE ("orderId"),
    CONSTRAINT "receipts_restaurant_id_id_key" UNIQUE ("restaurantId", "id"),
    CONSTRAINT "receipts_restaurant_order_id_key" UNIQUE ("restaurantId", "orderId"),
    CONSTRAINT "receipts_restaurant_receipt_number_key" UNIQUE ("restaurantId", "receiptNumber"),
    CONSTRAINT "receipts_discount_check" CHECK (
        ("discountAmount" IS NULL AND "discountCurrency" IS NULL)
        OR ("discountAmount" IS NOT NULL AND "discountCurrency" IS NOT NULL
            AND "discountAmount" >= 0 AND "discountCurrency" IN ('CDF', 'USD'))
    ),
    CONSTRAINT "receipts_settlement_consistency_check" CHECK (
        ("isSettled" = true AND "settledAt" IS NOT NULL)
        OR ("isSettled" = false AND "settledAt" IS NULL)
    ),
    CONSTRAINT "receipts_restaurantId_fkey" FOREIGN KEY ("restaurantId")
        REFERENCES "public"."restaurants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "receipts_restaurant_order_fkey" FOREIGN KEY ("restaurantId", "orderId")
        REFERENCES "public"."orders" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "receipts_cashier_user_fkey" FOREIGN KEY ("restaurantId", "cashierUserId")
        REFERENCES "public"."users" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "receipts_discount_authorizer_user_fkey" FOREIGN KEY ("restaurantId", "discountAuthorizedByUserId")
        REFERENCES "public"."users" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "receipts_restaurant_settled_idx"
    ON "public"."receipts" ("restaurantId", "isSettled", "createdAt");

-- Paiements (Payments)
CREATE TABLE "public"."payments" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "receiptId" UUID NOT NULL,
    "paymentMethod" "public"."payment_method" NOT NULL,
    "amountPaid" DECIMAL(12, 2) NOT NULL,
    "currencyPaid" VARCHAR(3) NOT NULL,
    "referenceNumber" VARCHAR(100),
    "cashierUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payments_restaurant_id_id_key" UNIQUE ("restaurantId", "id"),
    CONSTRAINT "payments_restaurantId_fkey" FOREIGN KEY ("restaurantId")
        REFERENCES "public"."restaurants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payments_restaurant_receipt_fkey" FOREIGN KEY ("restaurantId", "receiptId")
        REFERENCES "public"."receipts" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payments_cashier_user_fkey" FOREIGN KEY ("restaurantId", "cashierUserId")
        REFERENCES "public"."users" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payments_amount_positive_check" CHECK ("amountPaid" > 0),
    CONSTRAINT "payments_currency_check" CHECK ("currencyPaid" IN ('CDF', 'USD')),
    CONSTRAINT "payments_mobile_reference_check" CHECK (
        "paymentMethod" NOT IN ('MPESA', 'ORANGE_MONEY', 'AIRTEL_MONEY')
        OR ("referenceNumber" IS NOT NULL AND length(btrim("referenceNumber")) > 0)
    )
);

CREATE INDEX "payments_restaurant_receipt_idx"
    ON "public"."payments" ("restaurantId", "receiptId");

-- Traçabilité et Audit des Commandes (Order Audit Events)
CREATE TABLE "public"."order_audit_events" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "eventType" VARCHAR(60) NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_audit_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_audit_events_restaurant_id_id_key" UNIQUE ("restaurantId", "id"),
    CONSTRAINT "order_audit_events_restaurantId_fkey" FOREIGN KEY ("restaurantId")
        REFERENCES "public"."restaurants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "order_audit_events_restaurant_order_fkey" FOREIGN KEY ("restaurantId", "orderId")
        REFERENCES "public"."orders" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "order_audit_events_restaurant_actor_fkey" FOREIGN KEY ("restaurantId", "actorUserId")
        REFERENCES "public"."users" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "order_audit_events_restaurant_order_created_idx"
    ON "public"."order_audit_events" ("restaurantId", "orderId", "createdAt");

CREATE INDEX "order_audit_events_restaurant_created_idx"
    ON "public"."order_audit_events" ("restaurantId", "createdAt");

-- Database-level state guards complement server authorization. These invoker
-- functions do not bypass RLS and use a fixed search_path.
CREATE FUNCTION "restoplus_private"."guard_order_status_transition"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
    IF NEW."status" IS DISTINCT FROM OLD."status"
       AND NOT (
          (OLD."status" = 'WAITING_CASHIER'::public.order_status
            AND NEW."status" IN ('IN_PREPARATION'::public.order_status, 'CANCELLED'::public.order_status))
          OR (OLD."status" = 'IN_PREPARATION'::public.order_status
            AND NEW."status" IN ('READY'::public.order_status, 'CANCELLED'::public.order_status))
          OR (OLD."status" = 'READY'::public.order_status
            AND NEW."status" = 'COMPLETED'::public.order_status)
       ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Invalid order status transition';
    END IF;
    RETURN NEW;
END;
$function$;

CREATE FUNCTION "restoplus_private"."guard_ticket_status_transition"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
    IF NEW."status" IS DISTINCT FROM OLD."status"
       AND NOT (
          (OLD."status" = 'PENDING'::public.ticket_status
            AND NEW."status" = 'IN_PREPARATION'::public.ticket_status)
          OR (OLD."status" = 'IN_PREPARATION'::public.ticket_status
            AND NEW."status" = 'READY'::public.ticket_status)
       ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Invalid kitchen/bar ticket status transition';
    END IF;
    RETURN NEW;
END;
$function$;

CREATE FUNCTION "restoplus_private"."check_order_tickets_consistency"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
    IF NEW."status" IN (
        'IN_PREPARATION'::public.order_status,
        'READY'::public.order_status,
        'COMPLETED'::public.order_status
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.kitchen_bar_tickets AS t
            WHERE t."restaurantId" = NEW."restaurantId" AND t."orderId" = NEW."id"
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Order preparation requires at least one issued ticket';
        END IF;
        IF EXISTS (
            SELECT 1 FROM public.order_lines AS l
            WHERE l."restaurantId" = NEW."restaurantId" AND l."orderId" = NEW."id"
              AND NOT EXISTS (
                  SELECT 1 FROM public.kitchen_bar_tickets AS t
                  WHERE t."restaurantId" = l."restaurantId" AND t."orderId" = l."orderId"
                    AND t."station" = l."station"
              )
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Every order line station must have a ticket';
        END IF;
        IF NEW."status" IN ('READY'::public.order_status, 'COMPLETED'::public.order_status)
           AND EXISTS (
              SELECT 1 FROM public.kitchen_bar_tickets AS t
              WHERE t."restaurantId" = NEW."restaurantId" AND t."orderId" = NEW."id"
                AND t."status" <> 'READY'::public.ticket_status
           ) THEN
            RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'All tickets must be ready before the order is ready';
        END IF;
        IF NEW."status" = 'COMPLETED'::public.order_status
           AND NOT EXISTS (
              SELECT 1 FROM public.receipts AS r
              WHERE r."restaurantId" = NEW."restaurantId" AND r."orderId" = NEW."id"
                AND r."isSettled" = true
           ) THEN
            RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Completed order requires a settled receipt';
        END IF;
    END IF;
    RETURN NULL;
END;
$function$;

CREATE FUNCTION "restoplus_private"."check_ready_tickets_transition"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
DECLARE
    v_order_status public.order_status;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.kitchen_bar_tickets AS t
        WHERE t."restaurantId" = NEW."restaurantId" AND t."orderId" = NEW."orderId"
          AND t."status" <> 'READY'::public.ticket_status
    ) THEN
        SELECT o."status" INTO v_order_status FROM public.orders AS o
        WHERE o."restaurantId" = NEW."restaurantId" AND o."id" = NEW."orderId";
        IF v_order_status = 'IN_PREPARATION'::public.order_status THEN
            RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Order must move to READY when all tickets are ready';
        END IF;
    END IF;
    RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION "restoplus_private"."guard_order_status_transition"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "restoplus_private"."guard_ticket_status_transition"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "restoplus_private"."check_order_tickets_consistency"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "restoplus_private"."check_ready_tickets_transition"() FROM PUBLIC;

CREATE TRIGGER "orders_status_transition_guard"
BEFORE UPDATE OF "status" ON "public"."orders"
FOR EACH ROW EXECUTE FUNCTION "restoplus_private"."guard_order_status_transition"();
CREATE CONSTRAINT TRIGGER "orders_ticket_consistency_guard"
AFTER UPDATE OF "status" ON "public"."orders"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
WHEN (NEW."status" IN ('IN_PREPARATION'::public.order_status, 'READY'::public.order_status, 'COMPLETED'::public.order_status))
EXECUTE FUNCTION "restoplus_private"."check_order_tickets_consistency"();
CREATE TRIGGER "tickets_status_transition_guard"
BEFORE UPDATE OF "status" ON "public"."kitchen_bar_tickets"
FOR EACH ROW EXECUTE FUNCTION "restoplus_private"."guard_ticket_status_transition"();
CREATE CONSTRAINT TRIGGER "tickets_ready_consistency_guard"
AFTER UPDATE OF "status" ON "public"."kitchen_bar_tickets"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION "restoplus_private"."check_ready_tickets_transition"();

-- 3. Row Level Security : Activation et Forçage sur toutes les tables
-- ------------------------------------------------------------------

ALTER TABLE "public"."dining_tables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."dining_tables" FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."orders" FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."order_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."order_lines" FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."kitchen_bar_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kitchen_bar_tickets" FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."receipts" FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."payments" FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."order_audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."order_audit_events" FORCE ROW LEVEL SECURITY;

-- 4. Politiques RLS strictes pour le runtime tenant (restoplus_app)
-- ----------------------------------------------------------------

CREATE POLICY "dining_tables_tenant_isolation" ON "public"."dining_tables"
    FOR ALL TO restoplus_app
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid)
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);

CREATE POLICY "orders_tenant_isolation" ON "public"."orders"
    FOR ALL TO restoplus_app
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid)
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);

CREATE POLICY "order_lines_tenant_isolation" ON "public"."order_lines"
    FOR ALL TO restoplus_app
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid)
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);

CREATE POLICY "kitchen_bar_tickets_tenant_isolation" ON "public"."kitchen_bar_tickets"
    FOR ALL TO restoplus_app
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid)
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);

CREATE POLICY "receipts_tenant_isolation" ON "public"."receipts"
    FOR ALL TO restoplus_app
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid)
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);

CREATE POLICY "payments_tenant_isolation" ON "public"."payments"
    FOR ALL TO restoplus_app
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid)
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);

CREATE POLICY "order_audit_events_tenant_isolation" ON "public"."order_audit_events"
    FOR ALL TO restoplus_app
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid)
    WITH CHECK (
        "restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid
        AND "actorUserId" = NULLIF(current_setting('app.user_id', true), '')::uuid
    );

-- 5. Privilèges de tables pour restoplus_app (Principe du moindre privilège)
-- --------------------------------------------------------------------------
-- Aucune suppression (DELETE) accordée sur orders, kitchen_bar_tickets, receipts, payments,
-- et order_audit_events pour garantir l'intégrité comptable et la traçabilité.

GRANT SELECT ON "public"."dining_tables" TO restoplus_app;
GRANT SELECT, INSERT, UPDATE ON "public"."orders" TO restoplus_app;
GRANT SELECT, INSERT ON "public"."order_lines" TO restoplus_app;
GRANT SELECT, INSERT, UPDATE ON "public"."kitchen_bar_tickets" TO restoplus_app;
GRANT SELECT, INSERT, UPDATE ON "public"."receipts" TO restoplus_app;
GRANT SELECT, INSERT, UPDATE ON "public"."payments" TO restoplus_app;
GRANT SELECT, INSERT ON "public"."order_audit_events" TO restoplus_app;

