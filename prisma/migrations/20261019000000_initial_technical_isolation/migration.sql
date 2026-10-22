-- Initial technical schema and RLS policies. This migration has not been applied.
-- Required roles must be provisioned out of band before migration:
-- restoplus_app, restoplus_auth, restoplus_migrator, restoplus_bootstrap_owner,
-- and restoplus_account_ops. The account-ops role is NOLOGIN/NOBYPASSRLS and
-- receives only the column/table privileges required by its SECURITY DEFINER functions.

-- Prerequisites: public and restoplus_private already exist and are owned
-- by restoplus_migrator. Provision and verify them before this migration.

CREATE TYPE "public"."membership_role" AS ENUM (
    'OWNER',
    'MANAGER',
    'CASHIER',
    'WAITER',
    'KITCHEN',
    'STOCK_MANAGER'
);

CREATE TYPE "public"."membership_invitation_status" AS ENUM (
    'PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED'
);

CREATE TABLE "public"."restaurants" (
    "id" UUID NOT NULL,
    "publicCode" VARCHAR(24) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "restaurants_public_code_normalized_check"
        CHECK ("publicCode" <> '' AND "publicCode" = lower(btrim("publicCode")))
);

CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_restaurant_id_id_key" UNIQUE ("restaurantId", "id"),
    CONSTRAINT "users_restaurantId_fkey" FOREIGN KEY ("restaurantId")
        REFERENCES "public"."restaurants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "public"."auth_credentials" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "emailNormalized" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "auth_credentials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_credentials_user_id_key" UNIQUE ("userId"),
    CONSTRAINT "auth_credentials_restaurant_id_id_key" UNIQUE ("restaurantId", "id"),
    CONSTRAINT "auth_credentials_restaurant_email_key" UNIQUE ("restaurantId", "emailNormalized"),
    CONSTRAINT "auth_credentials_restaurant_user_key" UNIQUE ("restaurantId", "userId"),
    CONSTRAINT "auth_credentials_email_normalized_check"
        CHECK ("emailNormalized" = lower(btrim("emailNormalized"))),
    CONSTRAINT "auth_credentials_restaurantId_fkey" FOREIGN KEY ("restaurantId")
        REFERENCES "public"."restaurants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "auth_credentials_restaurant_user_fkey" FOREIGN KEY ("restaurantId", "userId")
        REFERENCES "public"."users" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "public"."memberships" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "public"."membership_role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "memberships_user_id_key" UNIQUE ("userId"),
    CONSTRAINT "memberships_restaurant_id_user_id_key" UNIQUE ("restaurantId", "userId"),
    CONSTRAINT "memberships_restaurantId_fkey" FOREIGN KEY ("restaurantId")
        REFERENCES "public"."restaurants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "memberships_restaurant_user_fkey" FOREIGN KEY ("restaurantId", "userId")
        REFERENCES "public"."users" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "public"."sessions" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "absoluteExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sessions_token_hash_key" UNIQUE ("tokenHash"),
    CONSTRAINT "sessions_restaurant_id_id_key" UNIQUE ("restaurantId", "id"),
    CONSTRAINT "sessions_restaurantId_fkey" FOREIGN KEY ("restaurantId")
        REFERENCES "public"."restaurants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sessions_restaurant_user_fkey" FOREIGN KEY ("restaurantId", "userId")
        REFERENCES "public"."users" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "public"."membership_invitations" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "emailNormalized" VARCHAR(320) NOT NULL,
    "role" "public"."membership_role" NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "status" "public"."membership_invitation_status" NOT NULL DEFAULT 'PENDING',
    "createdByUserId" UUID NOT NULL,
    "acceptedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    CONSTRAINT "membership_invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "membership_invitations_token_hash_key" UNIQUE ("tokenHash"),
    CONSTRAINT "membership_invitations_public_role_check" CHECK ("role" <> 'OWNER'::"public"."membership_role"),
    CONSTRAINT "membership_invitations_email_normalized_check" CHECK ("emailNormalized" = lower(btrim("emailNormalized"))),
    CONSTRAINT "membership_invitations_restaurant_fkey" FOREIGN KEY ("restaurantId")
        REFERENCES "public"."restaurants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "membership_invitations_creator_fkey" FOREIGN KEY ("restaurantId", "createdByUserId")
        REFERENCES "public"."users" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "membership_invitations_accepter_fkey" FOREIGN KEY ("restaurantId", "acceptedByUserId")
        REFERENCES "public"."users" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "public"."security_audit_events" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "actorUserId" UUID,
    "eventType" VARCHAR(80) NOT NULL,
    "targetType" VARCHAR(80) NOT NULL,
    "targetId" UUID,
    "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_audit_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "security_audit_events_restaurant_fkey" FOREIGN KEY ("restaurantId")
        REFERENCES "public"."restaurants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "security_audit_events_actor_fkey" FOREIGN KEY ("restaurantId", "actorUserId")
        REFERENCES "public"."users" ("restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "restaurants_public_code_key" ON "public"."restaurants" ("publicCode");
CREATE INDEX "users_restaurant_id_active_idx" ON "public"."users" ("restaurantId", "isActive");
CREATE INDEX "memberships_restaurant_role_active_idx" ON "public"."memberships" ("restaurantId", "role", "isActive");
CREATE INDEX "sessions_restaurant_user_revoked_idx" ON "public"."sessions" ("restaurantId", "userId", "revokedAt");
CREATE INDEX "sessions_absolute_expires_at_idx" ON "public"."sessions" ("absoluteExpiresAt");
CREATE INDEX "membership_invitations_restaurant_status_expiry_idx" ON "public"."membership_invitations" ("restaurantId", "status", "expiresAt");
CREATE INDEX "membership_invitations_restaurant_email_status_idx" ON "public"."membership_invitations" ("restaurantId", "emailNormalized", "status");
CREATE INDEX "security_audit_events_restaurant_created_idx" ON "public"."security_audit_events" ("restaurantId", "createdAt");
CREATE INDEX "security_audit_events_restaurant_type_created_idx" ON "public"."security_audit_events" ("restaurantId", "eventType", "createdAt");

-- Remove any default/current grants inherited by newly-created tables before adding the allowlist.
REVOKE ALL PRIVILEGES ON "public"."restaurants", "public"."users", "public"."auth_credentials", "public"."memberships", "public"."sessions", "public"."membership_invitations", "public"."security_audit_events"
    FROM PUBLIC, restoplus_app, restoplus_auth, restoplus_bootstrap_owner, restoplus_account_ops;
REVOKE ALL PRIVILEGES ON TYPE "public"."membership_role", "public"."membership_invitation_status"
    FROM PUBLIC, restoplus_app, restoplus_auth, restoplus_bootstrap_owner, restoplus_account_ops;
GRANT USAGE ON TYPE "public"."membership_role", "public"."membership_invitation_status"
    TO restoplus_app, restoplus_auth, restoplus_bootstrap_owner, restoplus_account_ops;
REVOKE CREATE ON SCHEMA "public" FROM PUBLIC, restoplus_app, restoplus_auth, restoplus_bootstrap_owner, restoplus_account_ops;
GRANT USAGE ON SCHEMA "public" TO restoplus_app, restoplus_auth, restoplus_bootstrap_owner;
GRANT USAGE ON SCHEMA "public" TO restoplus_account_ops;
REVOKE ALL ON SCHEMA "restoplus_private" FROM PUBLIC, restoplus_app, restoplus_auth, restoplus_bootstrap_owner, restoplus_account_ops;
GRANT USAGE ON SCHEMA "restoplus_private" TO restoplus_auth;

ALTER TABLE "public"."restaurants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."restaurants" FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."users" FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."auth_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."auth_credentials" FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."memberships" FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sessions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."membership_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."membership_invitations" FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."security_audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."security_audit_events" FORCE ROW LEVEL SECURITY;

-- Public code lookup reveals only a matching active restaurant's selected public columns.
CREATE POLICY "restaurants_app_select" ON "public"."restaurants"
    FOR SELECT TO restoplus_app
    USING ("id" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "restaurants_app_update" ON "public"."restaurants"
    FOR UPDATE TO restoplus_app
    USING ("id" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid)
    WITH CHECK ("id" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "restaurants_auth_code_lookup" ON "public"."restaurants"
    FOR SELECT TO restoplus_auth
    USING (
        "publicCode" = NULLIF(current_setting('app.restaurant_code', true), '')
    );
CREATE POLICY "restaurants_auth_current_tenant" ON "public"."restaurants"
    FOR SELECT TO restoplus_auth
    USING ("id" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "restaurants_bootstrap_insert" ON "public"."restaurants"
    FOR INSERT TO restoplus_bootstrap_owner
    WITH CHECK ("id" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);

CREATE POLICY "users_app_select" ON "public"."users"
    FOR SELECT TO restoplus_app
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "users_app_update" ON "public"."users"
    FOR UPDATE TO restoplus_app
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid)
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "users_auth_current_user" ON "public"."users"
    FOR SELECT TO restoplus_auth
    USING (
        "restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid
        AND "id" = NULLIF(current_setting('app.user_id', true), '')::uuid
    );
CREATE POLICY "users_bootstrap_insert" ON "public"."users"
    FOR INSERT TO restoplus_bootstrap_owner
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);

CREATE POLICY "auth_credentials_auth_lookup" ON "public"."auth_credentials"
    FOR SELECT TO restoplus_auth
    USING (
        "restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid
        AND "emailNormalized" = NULLIF(current_setting('app.email_normalized', true), '')
    );
CREATE POLICY "auth_credentials_bootstrap_insert" ON "public"."auth_credentials"
    FOR INSERT TO restoplus_bootstrap_owner
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "auth_credentials_app_deny" ON "public"."auth_credentials"
    FOR ALL TO restoplus_app
    USING (false)
    WITH CHECK (false);

CREATE POLICY "memberships_app_select" ON "public"."memberships"
    FOR SELECT TO restoplus_app
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "memberships_auth_current_user" ON "public"."memberships"
    FOR SELECT TO restoplus_auth
    USING (
        "restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid
        AND "userId" = NULLIF(current_setting('app.user_id', true), '')::uuid
    );
CREATE POLICY "memberships_bootstrap_owner_insert" ON "public"."memberships"
    FOR INSERT TO restoplus_bootstrap_owner
    WITH CHECK (
        "restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid
        AND "role" = 'OWNER'::"public"."membership_role"
    );

CREATE POLICY "membership_invitations_account_ops_select" ON "public"."membership_invitations"
    FOR SELECT TO restoplus_account_ops
    USING (
        "restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid
        OR "tokenHash" = NULLIF(current_setting('app.invitation_token_hash', true), '')
    );
CREATE POLICY "membership_invitations_account_ops_insert" ON "public"."membership_invitations"
    FOR INSERT TO restoplus_account_ops
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "membership_invitations_account_ops_update" ON "public"."membership_invitations"
    FOR UPDATE TO restoplus_account_ops
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid)
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "security_audit_events_account_ops_insert" ON "public"."security_audit_events"
    FOR INSERT TO restoplus_account_ops, restoplus_bootstrap_owner
    WITH CHECK (
        "restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid
        AND ("actorUserId" IS NULL OR "actorUserId" = NULLIF(current_setting('app.user_id', true), '')::uuid)
    );

-- Auth lookup by opaque token hash works before restaurant/user context exists.
CREATE POLICY "sessions_auth_token_lookup" ON "public"."sessions"
    FOR SELECT TO restoplus_auth
    USING (
        "tokenHash" = NULLIF(current_setting('app.session_token_hash', true), '')
    );
CREATE POLICY "sessions_auth_current_user_select" ON "public"."sessions"
    FOR SELECT TO restoplus_auth
    USING (
        "restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid
        AND "userId" = NULLIF(current_setting('app.user_id', true), '')::uuid
    );
CREATE POLICY "sessions_auth_current_user_insert" ON "public"."sessions"
    FOR INSERT TO restoplus_auth
    WITH CHECK (
        "restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid
        AND "userId" = NULLIF(current_setting('app.user_id', true), '')::uuid
        AND EXISTS (SELECT 1 FROM public.restaurants AS r WHERE r."id" = "restaurantId" AND r."isActive")
        AND EXISTS (SELECT 1 FROM public.users AS u WHERE u."restaurantId" = "restaurantId" AND u."id" = "userId" AND u."isActive")
        AND EXISTS (SELECT 1 FROM public.memberships AS m WHERE m."restaurantId" = "restaurantId" AND m."userId" = "userId" AND m."isActive")
    );
CREATE POLICY "sessions_auth_current_user_update" ON "public"."sessions"
    FOR UPDATE TO restoplus_auth
    USING (
        "restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid
        AND "userId" = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
    WITH CHECK (
        "restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid
        AND "userId" = NULLIF(current_setting('app.user_id', true), '')::uuid
    );

-- Immutable public code and no physical restaurant deletion for ordinary roles.
CREATE FUNCTION "restoplus_private"."protect_restaurant_identity"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Physical deletion of a restaurant is forbidden';
    END IF;
    IF NEW."publicCode" IS DISTINCT FROM OLD."publicCode" THEN
        RAISE EXCEPTION 'Restaurant publicCode is immutable';
    END IF;
    RETURN NEW;
END;
$function$;

CREATE TRIGGER "restaurants_identity_immutable"
BEFORE UPDATE OF "publicCode" OR DELETE ON "public"."restaurants"
FOR EACH ROW EXECUTE FUNCTION "restoplus_private"."protect_restaurant_identity"();
REVOKE ALL ON FUNCTION "restoplus_private"."protect_restaurant_identity"() FROM PUBLIC;

-- The bootstrap role is provisioned NOLOGIN/NOBYPASSRLS. Migration setup grants it
-- temporarily to the migration executor solely to SET ROLE while defining this function.
GRANT USAGE, CREATE ON SCHEMA "restoplus_private" TO restoplus_bootstrap_owner;
GRANT INSERT ("id", "publicCode", "name", "updatedAt") ON "public"."restaurants" TO restoplus_bootstrap_owner;
GRANT INSERT ("id", "restaurantId", "displayName", "updatedAt") ON "public"."users" TO restoplus_bootstrap_owner;
GRANT INSERT ("id", "restaurantId", "userId", "emailNormalized", "passwordHash", "updatedAt") ON "public"."auth_credentials" TO restoplus_bootstrap_owner;
GRANT INSERT ("id", "restaurantId", "userId", "role") ON "public"."memberships" TO restoplus_bootstrap_owner;
GRANT INSERT ("id", "restaurantId", "actorUserId", "eventType", "targetType", "targetId", "details") ON "public"."security_audit_events" TO restoplus_bootstrap_owner;
SET ROLE restoplus_bootstrap_owner;
CREATE FUNCTION "restoplus_private"."bootstrap_restaurant_owner"(
    p_restaurant_id UUID,
    p_public_code VARCHAR,
    p_restaurant_name VARCHAR,
    p_user_id UUID,
    p_display_name VARCHAR,
    p_email_normalized VARCHAR,
    p_password_hash VARCHAR
)
RETURNS TABLE ("restaurantId" UUID, "userId" UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $bootstrap$
BEGIN
    IF p_restaurant_id IS NULL OR p_user_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Identifiers are required';
    END IF;
    IF p_public_code IS NULL OR p_public_code = '' OR p_public_code <> lower(btrim(p_public_code)) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Public code must be normalized';
    END IF;
    IF p_email_normalized IS NULL OR p_email_normalized <> lower(btrim(p_email_normalized)) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Email must be normalized';
    END IF;
    IF p_password_hash IS NULL OR p_password_hash = '' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Password hash is required';
    END IF;

    PERFORM pg_catalog.set_config('app.restaurant_id', p_restaurant_id::text, true);
    PERFORM pg_catalog.set_config('app.user_id', p_user_id::text, true);
    INSERT INTO public.restaurants ("id", "publicCode", "name", "updatedAt")
    VALUES (p_restaurant_id, p_public_code, p_restaurant_name, CURRENT_TIMESTAMP);
    INSERT INTO public.users ("id", "restaurantId", "displayName", "updatedAt")
    VALUES (p_user_id, p_restaurant_id, p_display_name, CURRENT_TIMESTAMP);
    INSERT INTO public.auth_credentials ("id", "restaurantId", "userId", "emailNormalized", "passwordHash", "updatedAt")
    VALUES (pg_catalog.gen_random_uuid(), p_restaurant_id, p_user_id, p_email_normalized, p_password_hash, CURRENT_TIMESTAMP);
    INSERT INTO public.memberships ("id", "restaurantId", "userId", "role")
    VALUES (pg_catalog.gen_random_uuid(), p_restaurant_id, p_user_id, 'OWNER'::public.membership_role);
    INSERT INTO public.security_audit_events ("id", "restaurantId", "actorUserId", "eventType", "targetType", "targetId", "details")
    VALUES (pg_catalog.gen_random_uuid(), p_restaurant_id, p_user_id, 'RESTAURANT_BOOTSTRAPPED', 'restaurant', p_restaurant_id, '{"role":"OWNER"}'::jsonb);

    RETURN QUERY SELECT p_restaurant_id, p_user_id;
END;
$bootstrap$;
REVOKE ALL ON FUNCTION "restoplus_private"."bootstrap_restaurant_owner"(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "restoplus_private"."bootstrap_restaurant_owner"(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, VARCHAR) TO restoplus_auth;
RESET ROLE;
REVOKE CREATE ON SCHEMA "restoplus_private" FROM restoplus_bootstrap_owner;
GRANT USAGE ON SCHEMA "restoplus_private" TO restoplus_auth;

-- Runtime table grants. Roles must have no inherited/PUBLIC grants that widen these.
-- Account creation, membership role/status changes, account activation/deactivation,
-- and restaurant activation are intentionally not direct app-role writes. Their
-- business authorization rules must be approved before exposing a server-side
-- operation or a narrowly-scoped database function. Tenant RLS is not authorization.
GRANT SELECT ("id", "publicCode", "name", "isActive", "createdAt", "updatedAt") ON "public"."restaurants" TO restoplus_app;
GRANT UPDATE ("name", "updatedAt") ON "public"."restaurants" TO restoplus_app;
GRANT SELECT ON "public"."users" TO restoplus_app;
GRANT UPDATE ("displayName", "updatedAt") ON "public"."users" TO restoplus_app;
GRANT SELECT ON "public"."memberships" TO restoplus_app;
REVOKE ALL ON "public"."auth_credentials", "public"."sessions" FROM restoplus_app;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON "public"."restaurants", "public"."users", "public"."auth_credentials", "public"."memberships", "public"."sessions" FROM restoplus_app;

GRANT SELECT ("id", "publicCode", "name", "isActive", "createdAt", "updatedAt") ON "public"."restaurants" TO restoplus_auth;
GRANT SELECT ("id", "restaurantId", "displayName", "isActive", "createdAt", "updatedAt") ON "public"."users" TO restoplus_auth;
GRANT SELECT ("id", "restaurantId", "userId", "emailNormalized", "passwordHash", "createdAt", "updatedAt") ON "public"."auth_credentials" TO restoplus_auth;
GRANT SELECT ("id", "restaurantId", "userId", "role", "isActive", "createdAt") ON "public"."memberships" TO restoplus_auth;
GRANT SELECT ("id", "restaurantId", "userId", "tokenHash", "createdAt", "lastSeenAt", "absoluteExpiresAt", "revokedAt") ON "public"."sessions" TO restoplus_auth;
GRANT INSERT ("id", "restaurantId", "userId", "tokenHash", "absoluteExpiresAt") ON "public"."sessions" TO restoplus_auth;
GRANT UPDATE ("lastSeenAt", "revokedAt") ON "public"."sessions" TO restoplus_auth;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON "public"."restaurants", "public"."users", "public"."auth_credentials", "public"."memberships" FROM restoplus_auth;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON "public"."sessions" FROM restoplus_auth;

-- Account operations run only through narrowly-scoped SECURITY DEFINER functions.
-- This NOLOGIN role must be provisioned out of band and must not be granted to a
-- runtime role. The migration executor needs a separate temporary SET membership.
GRANT USAGE ON SCHEMA "restoplus_private" TO restoplus_account_ops;
GRANT SELECT ON "public"."restaurants", "public"."users", "public"."memberships", "public"."membership_invitations", "public"."sessions" TO restoplus_account_ops;
GRANT SELECT ("restaurantId", "emailNormalized") ON "public"."auth_credentials" TO restoplus_account_ops;
GRANT INSERT ("id", "restaurantId", "emailNormalized", "role", "tokenHash", "createdByUserId", "expiresAt") ON "public"."membership_invitations" TO restoplus_account_ops;
GRANT UPDATE ("status", "acceptedByUserId", "acceptedAt", "cancelledAt") ON "public"."membership_invitations" TO restoplus_account_ops;
GRANT INSERT ("id", "restaurantId", "displayName", "updatedAt") ON "public"."users" TO restoplus_account_ops;
GRANT INSERT ("id", "restaurantId", "userId", "emailNormalized", "passwordHash", "updatedAt") ON "public"."auth_credentials" TO restoplus_account_ops;
GRANT INSERT ("id", "restaurantId", "userId", "role", "isActive") ON "public"."memberships" TO restoplus_account_ops;
GRANT UPDATE ("role", "isActive") ON "public"."memberships" TO restoplus_account_ops;
GRANT UPDATE ("isActive", "updatedAt") ON "public"."users" TO restoplus_account_ops;
GRANT UPDATE ("isActive", "updatedAt") ON "public"."restaurants" TO restoplus_account_ops;
GRANT UPDATE ("revokedAt") ON "public"."sessions" TO restoplus_account_ops;
GRANT INSERT ("id", "restaurantId", "actorUserId", "eventType", "targetType", "targetId", "details") ON "public"."security_audit_events" TO restoplus_account_ops;

CREATE POLICY "restaurants_account_ops_select" ON "public"."restaurants"
    FOR SELECT TO restoplus_account_ops
    USING ("id" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "restaurants_account_ops_update" ON "public"."restaurants"
    FOR UPDATE TO restoplus_account_ops
    USING ("id" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid)
    WITH CHECK ("id" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "users_account_ops_select" ON "public"."users"
    FOR SELECT TO restoplus_account_ops
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "users_account_ops_insert" ON "public"."users"
    FOR INSERT TO restoplus_account_ops
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "users_account_ops_update" ON "public"."users"
    FOR UPDATE TO restoplus_account_ops
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid)
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "credentials_account_ops_select" ON "public"."auth_credentials"
    FOR SELECT TO restoplus_account_ops
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "credentials_account_ops_insert" ON "public"."auth_credentials"
    FOR INSERT TO restoplus_account_ops
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "memberships_account_ops_select" ON "public"."memberships"
    FOR SELECT TO restoplus_account_ops
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "memberships_account_ops_insert" ON "public"."memberships"
    FOR INSERT TO restoplus_account_ops
    WITH CHECK (
        "restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid
        AND "role" <> 'OWNER'::"public"."membership_role"
    );
CREATE POLICY "memberships_account_ops_update" ON "public"."memberships"
    FOR UPDATE TO restoplus_account_ops
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid)
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "sessions_account_ops_select" ON "public"."sessions"
    FOR SELECT TO restoplus_account_ops
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "sessions_account_ops_update" ON "public"."sessions"
    FOR UPDATE TO restoplus_account_ops
    USING ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid)
    WITH CHECK ("restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid);
CREATE POLICY "security_audit_events_account_ops_insert_tenant" ON "public"."security_audit_events"
    FOR INSERT TO restoplus_account_ops
    WITH CHECK (
        "restaurantId" = NULLIF(current_setting('app.restaurant_id', true), '')::uuid
        AND "actorUserId" = NULLIF(current_setting('app.user_id', true), '')::uuid
    );

GRANT USAGE, CREATE ON SCHEMA "restoplus_private" TO restoplus_account_ops;
SET ROLE restoplus_account_ops;

CREATE FUNCTION "restoplus_private"."create_membership_invitation"(
    p_id UUID, p_email_normalized VARCHAR, p_role public.membership_role,
    p_token_hash VARCHAR, p_expires_at TIMESTAMPTZ
) RETURNS TABLE ("invitationId" UUID, "expiresAt" TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
    v_restaurant_id UUID := NULLIF(current_setting('app.restaurant_id', true), '')::uuid;
    v_actor_id UUID := NULLIF(current_setting('app.user_id', true), '')::uuid;
    v_actor_role public.membership_role;
BEGIN
    IF v_restaurant_id IS NULL OR v_actor_id IS NULL OR p_id IS NULL OR p_token_hash IS NULL OR length(p_token_hash) <> 64 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid invitation request';
    END IF;
    IF p_email_normalized IS NULL OR p_email_normalized = '' OR p_email_normalized <> lower(btrim(p_email_normalized)) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Email must be normalized';
    END IF;
    IF p_role IS NULL OR p_role = 'OWNER'::public.membership_role THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'OWNER can only be assigned by an active OWNER to an existing member';
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_restaurant_id::text, 0));
    SELECT m."role" INTO v_actor_role
    FROM public.memberships AS m JOIN public.users AS u
      ON u."restaurantId" = m."restaurantId" AND u."id" = m."userId"
    JOIN public.restaurants AS r ON r."id" = m."restaurantId"
    WHERE m."restaurantId" = v_restaurant_id AND m."userId" = v_actor_id
      AND m."isActive" AND u."isActive" AND r."isActive";
    IF v_actor_role IS NULL OR v_actor_role NOT IN ('OWNER'::public.membership_role, 'MANAGER'::public.membership_role) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Active OWNER or MANAGER membership required';
    END IF;
    IF v_actor_role = 'MANAGER'::public.membership_role AND p_role = 'OWNER'::public.membership_role THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Only an OWNER may promote another member to OWNER';
    END IF;
    IF p_expires_at IS NULL OR p_expires_at <= pg_catalog.clock_timestamp() OR p_expires_at > pg_catalog.clock_timestamp() + interval '7 days' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invitation expiry must be within seven days';
    END IF;
    IF EXISTS (SELECT 1 FROM public.auth_credentials AS c WHERE c."restaurantId" = v_restaurant_id AND c."emailNormalized" = p_email_normalized) THEN
        RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'An account already exists for this restaurant and email';
    END IF;
    IF EXISTS (SELECT 1 FROM public.membership_invitations AS i WHERE i."restaurantId" = v_restaurant_id AND i."emailNormalized" = p_email_normalized AND i."status" = 'PENDING'::public.membership_invitation_status AND i."expiresAt" > pg_catalog.clock_timestamp()) THEN
        RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'An active invitation already exists';
    END IF;
    INSERT INTO public.membership_invitations ("id", "restaurantId", "emailNormalized", "role", "tokenHash", "createdByUserId", "expiresAt")
    VALUES (p_id, v_restaurant_id, p_email_normalized, p_role, p_token_hash, v_actor_id, p_expires_at);
    INSERT INTO public.security_audit_events ("id", "restaurantId", "actorUserId", "eventType", "targetType", "targetId", "details")
    VALUES (pg_catalog.gen_random_uuid(), v_restaurant_id, v_actor_id, 'MEMBERSHIP_INVITATION_CREATED', 'invitation', p_id, pg_catalog.jsonb_build_object('role', p_role::text));
    RETURN QUERY SELECT p_id, p_expires_at;
END;
$function$;

CREATE FUNCTION "restoplus_private"."cancel_membership_invitation"(p_invitation_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
    v_restaurant_id UUID := NULLIF(current_setting('app.restaurant_id', true), '')::uuid;
    v_actor_id UUID := NULLIF(current_setting('app.user_id', true), '')::uuid;
    v_actor_role public.membership_role;
    v_invitation public.membership_invitations%ROWTYPE;
BEGIN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_restaurant_id::text, 0));
    SELECT m."role" INTO v_actor_role FROM public.memberships AS m JOIN public.users AS u
      ON u."restaurantId" = m."restaurantId" AND u."id" = m."userId"
    JOIN public.restaurants AS r ON r."id" = m."restaurantId"
    WHERE m."restaurantId" = v_restaurant_id AND m."userId" = v_actor_id AND m."isActive" AND u."isActive" AND r."isActive";
    IF v_actor_role IS NULL OR v_actor_role NOT IN ('OWNER'::public.membership_role, 'MANAGER'::public.membership_role) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Active OWNER or MANAGER membership required';
    END IF;
    SELECT * INTO v_invitation FROM public.membership_invitations AS i
      WHERE i."restaurantId" = v_restaurant_id AND i."id" = p_invitation_id FOR UPDATE;
    IF NOT FOUND OR v_invitation."status" <> 'PENDING'::public.membership_invitation_status THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Pending invitation not found';
    END IF;
    UPDATE public.membership_invitations SET "status" = 'CANCELLED'::public.membership_invitation_status, "cancelledAt" = pg_catalog.clock_timestamp()
      WHERE "restaurantId" = v_restaurant_id AND "id" = p_invitation_id;
    INSERT INTO public.security_audit_events ("id", "restaurantId", "actorUserId", "eventType", "targetType", "targetId", "details")
    VALUES (pg_catalog.gen_random_uuid(), v_restaurant_id, v_actor_id, 'MEMBERSHIP_INVITATION_CANCELLED', 'invitation', p_invitation_id, '{}'::jsonb);
END;
$function$;

CREATE FUNCTION "restoplus_private"."list_membership_invitations"()
RETURNS TABLE ("invitationId" UUID, "emailNormalized" VARCHAR, "role" public.membership_role, "createdAt" TIMESTAMPTZ, "expiresAt" TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
    v_restaurant_id UUID := NULLIF(current_setting('app.restaurant_id', true), '')::uuid;
    v_actor_id UUID := NULLIF(current_setting('app.user_id', true), '')::uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.memberships AS m JOIN public.users AS u
        ON u."restaurantId" = m."restaurantId" AND u."id" = m."userId"
        JOIN public.restaurants AS r ON r."id" = m."restaurantId"
        WHERE m."restaurantId" = v_restaurant_id AND m."userId" = v_actor_id
          AND m."role" IN ('OWNER'::public.membership_role, 'MANAGER'::public.membership_role)
          AND m."isActive" AND u."isActive" AND r."isActive") THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Active OWNER or MANAGER membership required';
    END IF;
    RETURN QUERY SELECT i."id", i."emailNormalized", i."role", i."createdAt", i."expiresAt"
      FROM public.membership_invitations AS i WHERE i."restaurantId" = v_restaurant_id
        AND i."status" = 'PENDING'::public.membership_invitation_status
        AND i."expiresAt" > pg_catalog.clock_timestamp()
      ORDER BY i."createdAt" DESC;
END;
$function$;

CREATE FUNCTION "restoplus_private"."manage_member"(
    p_target_user_id UUID,
    p_new_role public.membership_role,
    p_membership_active BOOLEAN,
    p_user_active BOOLEAN
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
    v_restaurant_id UUID := NULLIF(current_setting('app.restaurant_id', true), '')::uuid;
    v_actor_id UUID := NULLIF(current_setting('app.user_id', true), '')::uuid;
    v_actor_role public.membership_role;
    v_old_role public.membership_role;
    v_old_membership_active BOOLEAN;
    v_old_user_active BOOLEAN;
    v_owner_count BIGINT;
    v_new_role public.membership_role;
    v_new_membership_active BOOLEAN;
    v_new_user_active BOOLEAN;
BEGIN
    IF v_restaurant_id IS NULL OR v_actor_id IS NULL OR p_target_user_id IS NULL OR
       (p_new_role IS NULL AND p_membership_active IS NULL AND p_user_active IS NULL) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid member update';
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_restaurant_id::text, 0));
    SELECT m."role" INTO v_actor_role FROM public.memberships AS m JOIN public.users AS u
      ON u."restaurantId" = m."restaurantId" AND u."id" = m."userId"
    JOIN public.restaurants AS r ON r."id" = m."restaurantId"
    WHERE m."restaurantId" = v_restaurant_id AND m."userId" = v_actor_id AND m."isActive" AND u."isActive" AND r."isActive";
    IF v_actor_role IS NULL OR v_actor_role NOT IN ('OWNER'::public.membership_role, 'MANAGER'::public.membership_role) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Active OWNER or MANAGER membership required';
    END IF;
    SELECT m."role", m."isActive", u."isActive" INTO v_old_role, v_old_membership_active, v_old_user_active
      FROM public.memberships AS m JOIN public.users AS u
        ON u."restaurantId" = m."restaurantId" AND u."id" = m."userId"
      WHERE m."restaurantId" = v_restaurant_id AND m."userId" = p_target_user_id FOR UPDATE OF m, u;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Member not found'; END IF;
    v_new_role := COALESCE(p_new_role, v_old_role);
    v_new_membership_active := COALESCE(p_membership_active, v_old_membership_active);
    v_new_user_active := COALESCE(p_user_active, v_old_user_active);
    IF p_new_role = 'OWNER'::public.membership_role AND (NOT v_old_membership_active OR NOT v_old_user_active) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Only an active member can be promoted to OWNER';
    END IF;
    IF p_new_role IS NOT NULL AND p_new_role = 'OWNER'::public.membership_role AND
       (v_actor_role <> 'OWNER'::public.membership_role OR p_target_user_id = v_actor_id AND v_old_role <> 'OWNER'::public.membership_role) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Only an active OWNER may promote another member to OWNER';
    END IF;
    IF v_actor_role = 'MANAGER'::public.membership_role AND v_old_role = 'OWNER'::public.membership_role THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'MANAGER cannot modify an OWNER';
    END IF;
    IF v_old_role = 'OWNER'::public.membership_role AND v_old_membership_active AND v_old_user_active AND
       (v_new_role <> 'OWNER'::public.membership_role OR NOT v_new_membership_active OR NOT v_new_user_active) THEN
        SELECT count(*) INTO v_owner_count FROM public.memberships AS m JOIN public.users AS u
          ON u."restaurantId" = m."restaurantId" AND u."id" = m."userId"
          WHERE m."restaurantId" = v_restaurant_id AND m."role" = 'OWNER'::public.membership_role
            AND m."isActive" AND u."isActive";
        IF v_owner_count <= 1 THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'The last active OWNER cannot be disabled or demoted'; END IF;
    END IF;
    UPDATE public.memberships SET "role" = v_new_role, "isActive" = v_new_membership_active
      WHERE "restaurantId" = v_restaurant_id AND "userId" = p_target_user_id;
    UPDATE public.users SET "isActive" = v_new_user_active, "updatedAt" = pg_catalog.clock_timestamp()
      WHERE "restaurantId" = v_restaurant_id AND "id" = p_target_user_id;
    IF NOT v_new_membership_active OR NOT v_new_user_active THEN
        UPDATE public.sessions SET "revokedAt" = COALESCE("revokedAt", pg_catalog.clock_timestamp())
          WHERE "restaurantId" = v_restaurant_id AND "userId" = p_target_user_id;
    END IF;
    INSERT INTO public.security_audit_events ("id", "restaurantId", "actorUserId", "eventType", "targetType", "targetId", "details")
    VALUES (pg_catalog.gen_random_uuid(), v_restaurant_id, v_actor_id, 'MEMBER_UPDATED', 'user', p_target_user_id,
      pg_catalog.jsonb_build_object('oldRole', v_old_role::text, 'newRole', v_new_role::text,
        'oldMembershipActive', v_old_membership_active, 'newMembershipActive', v_new_membership_active,
        'oldUserActive', v_old_user_active, 'newUserActive', v_new_user_active));
END;
$function$;

CREATE FUNCTION "restoplus_private"."set_restaurant_active"(p_is_active BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
    v_restaurant_id UUID := NULLIF(current_setting('app.restaurant_id', true), '')::uuid;
    v_actor_id UUID := NULLIF(current_setting('app.user_id', true), '')::uuid;
BEGIN
    IF p_is_active IS DISTINCT FROM false THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Use the credential-verified reactivation flow'; END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_restaurant_id::text, 0));
    IF NOT EXISTS (SELECT 1 FROM public.memberships AS m JOIN public.users AS u
        ON u."restaurantId" = m."restaurantId" AND u."id" = m."userId"
        WHERE m."restaurantId" = v_restaurant_id AND m."userId" = v_actor_id AND m."role" = 'OWNER'::public.membership_role AND m."isActive" AND u."isActive") THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Active OWNER membership required';
    END IF;
    UPDATE public.restaurants SET "isActive" = false, "updatedAt" = pg_catalog.clock_timestamp() WHERE "id" = v_restaurant_id AND "isActive";
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Active restaurant not found'; END IF;
    UPDATE public.sessions SET "revokedAt" = COALESCE("revokedAt", pg_catalog.clock_timestamp()) WHERE "restaurantId" = v_restaurant_id;
    INSERT INTO public.security_audit_events ("id", "restaurantId", "actorUserId", "eventType", "targetType", "targetId", "details")
      VALUES (pg_catalog.gen_random_uuid(), v_restaurant_id, v_actor_id, 'RESTAURANT_DEACTIVATED', 'restaurant', v_restaurant_id, '{}'::jsonb);
END;
$function$;

CREATE FUNCTION "restoplus_private"."reactivate_restaurant"(p_restaurant_id UUID, p_owner_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_restaurant_id::text, 0));
    PERFORM pg_catalog.set_config('app.restaurant_id', p_restaurant_id::text, true);
    PERFORM pg_catalog.set_config('app.user_id', p_owner_user_id::text, true);
    IF NOT EXISTS (SELECT 1 FROM public.memberships AS m JOIN public.users AS u
        ON u."restaurantId" = m."restaurantId" AND u."id" = m."userId"
        WHERE m."restaurantId" = p_restaurant_id AND m."userId" = p_owner_user_id AND m."role" = 'OWNER'::public.membership_role AND m."isActive" AND u."isActive") THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Credential-verified active OWNER membership required';
    END IF;
    UPDATE public.restaurants SET "isActive" = true, "updatedAt" = pg_catalog.clock_timestamp() WHERE "id" = p_restaurant_id AND NOT "isActive";
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Inactive restaurant not found'; END IF;
    INSERT INTO public.security_audit_events ("id", "restaurantId", "actorUserId", "eventType", "targetType", "targetId", "details")
      VALUES (pg_catalog.gen_random_uuid(), p_restaurant_id, p_owner_user_id, 'RESTAURANT_REACTIVATED', 'restaurant', p_restaurant_id, '{"sessions":"previous sessions remain revoked"}'::jsonb);
END;
$function$;

CREATE FUNCTION "restoplus_private"."accept_membership_invitation"(
    p_token_hash VARCHAR, p_user_id UUID, p_display_name VARCHAR, p_password_hash VARCHAR
) RETURNS TABLE ("restaurantId" UUID, "userId" UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
    v_invitation public.membership_invitations%ROWTYPE;
    v_restaurant_id UUID;
BEGIN
    IF p_token_hash IS NULL OR length(p_token_hash) <> 64 OR p_user_id IS NULL OR p_password_hash IS NULL OR p_password_hash = '' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid invitation acceptance';
    END IF;
    PERFORM pg_catalog.set_config('app.invitation_token_hash', p_token_hash, true);
    SELECT i."restaurantId" INTO v_restaurant_id
      FROM public.membership_invitations AS i WHERE i."tokenHash" = p_token_hash;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Invitation is invalid or expired';
    END IF;
    PERFORM pg_catalog.set_config('app.restaurant_id', v_restaurant_id::text, true);
    PERFORM pg_catalog.set_config('app.user_id', p_user_id::text, true);
    SELECT * INTO v_invitation FROM public.membership_invitations AS i
      WHERE i."restaurantId" = v_restaurant_id AND i."tokenHash" = p_token_hash FOR UPDATE;
    IF NOT FOUND OR v_invitation."status" <> 'PENDING'::public.membership_invitation_status OR v_invitation."expiresAt" <= pg_catalog.clock_timestamp() THEN
        RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Invitation is invalid or expired';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.restaurants AS r WHERE r."id" = v_invitation."restaurantId" AND r."isActive") THEN
        RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Restaurant is inactive';
    END IF;
    IF EXISTS (SELECT 1 FROM public.auth_credentials AS c WHERE c."restaurantId" = v_invitation."restaurantId" AND c."emailNormalized" = v_invitation."emailNormalized") THEN
        RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'An account already exists for this restaurant and email';
    END IF;
    INSERT INTO public.users ("id", "restaurantId", "displayName", "updatedAt")
      VALUES (p_user_id, v_invitation."restaurantId", p_display_name, pg_catalog.clock_timestamp());
    INSERT INTO public.auth_credentials ("id", "restaurantId", "userId", "emailNormalized", "passwordHash", "updatedAt")
      VALUES (pg_catalog.gen_random_uuid(), v_invitation."restaurantId", p_user_id, v_invitation."emailNormalized", p_password_hash, pg_catalog.clock_timestamp());
    INSERT INTO public.memberships ("id", "restaurantId", "userId", "role")
      VALUES (pg_catalog.gen_random_uuid(), v_invitation."restaurantId", p_user_id, v_invitation."role");
    UPDATE public.membership_invitations AS i SET "status" = 'ACCEPTED'::public.membership_invitation_status,
      "acceptedByUserId" = p_user_id, "acceptedAt" = pg_catalog.clock_timestamp()
      WHERE i."restaurantId" = v_invitation."restaurantId" AND i."id" = v_invitation."id";
    INSERT INTO public.security_audit_events ("id", "restaurantId", "actorUserId", "eventType", "targetType", "targetId", "details")
      VALUES (pg_catalog.gen_random_uuid(), v_invitation."restaurantId", p_user_id, 'MEMBERSHIP_INVITATION_ACCEPTED', 'membership', p_user_id,
        pg_catalog.jsonb_build_object('role', v_invitation."role"::text));
    RETURN QUERY SELECT v_invitation."restaurantId", p_user_id;
END;
$function$;

CREATE FUNCTION "restoplus_private"."invitation_is_valid"(p_token_hash VARCHAR)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
    v_restaurant_id UUID;
    v_valid BOOLEAN;
BEGIN
    IF p_token_hash IS NULL OR length(p_token_hash) <> 64 THEN RETURN false; END IF;
    PERFORM pg_catalog.set_config('app.invitation_token_hash', p_token_hash, true);
    SELECT i."restaurantId" INTO v_restaurant_id FROM public.membership_invitations AS i
      WHERE i."tokenHash" = p_token_hash AND i."status" = 'PENDING'::public.membership_invitation_status
        AND i."expiresAt" > pg_catalog.clock_timestamp();
    IF NOT FOUND THEN RETURN false; END IF;
    PERFORM pg_catalog.set_config('app.restaurant_id', v_restaurant_id::text, true);
    SELECT EXISTS (SELECT 1 FROM public.restaurants AS r WHERE r."id" = v_restaurant_id AND r."isActive") INTO v_valid;
    RETURN v_valid;
END;
$function$;

REVOKE ALL ON FUNCTION "restoplus_private"."create_membership_invitation"(UUID, VARCHAR, public.membership_role, VARCHAR, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION "restoplus_private"."cancel_membership_invitation"(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION "restoplus_private"."list_membership_invitations"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "restoplus_private"."manage_member"(UUID, public.membership_role, BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION "restoplus_private"."set_restaurant_active"(BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION "restoplus_private"."reactivate_restaurant"(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION "restoplus_private"."accept_membership_invitation"(VARCHAR, UUID, VARCHAR, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION "restoplus_private"."invitation_is_valid"(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "restoplus_private"."create_membership_invitation"(UUID, VARCHAR, public.membership_role, VARCHAR, TIMESTAMPTZ), "restoplus_private"."cancel_membership_invitation"(UUID), "restoplus_private"."list_membership_invitations"(), "restoplus_private"."manage_member"(UUID, public.membership_role, BOOLEAN, BOOLEAN), "restoplus_private"."set_restaurant_active"(BOOLEAN) TO restoplus_app;
GRANT EXECUTE ON FUNCTION "restoplus_private"."reactivate_restaurant"(UUID, UUID), "restoplus_private"."accept_membership_invitation"(VARCHAR, UUID, VARCHAR, VARCHAR), "restoplus_private"."invitation_is_valid"(VARCHAR) TO restoplus_auth;
RESET ROLE;
REVOKE CREATE ON SCHEMA "restoplus_private" FROM restoplus_account_ops;
GRANT USAGE ON SCHEMA "restoplus_private" TO restoplus_app, restoplus_auth;
