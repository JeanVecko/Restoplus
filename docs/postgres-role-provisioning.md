# Provisionnement des rôles PostgreSQL Resto+

Cette procédure décrit les prérequis de la migration RLS. Elle n'a pas été exécutée. Les commandes SQL ci-dessous sont des exemples de provisionnement et de vérification à faire valider par l'administrateur PostgreSQL; elles ne sont pas exécutées par le projet ni par Codex. Ne mettez aucun mot de passe dans le dépôt, ce document ou les journaux. Configurez les secrets séparément par un canal local sûr.

## Rôles, attributs et propriétaires

| Rôle                        | Connexion | Attributs attendus                                                                | Propriété et finalité                                                                                                                                                    |
| --------------------------- | --------: | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `restoplus_migrator`        |       Oui | `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`         | Connexion Prisma Migrate; propriétaire des tables/type créés par la migration, du schéma privé et de la fonction trigger. DDL contrôlé; aucun DML ordinaire.             |
| `restoplus_app`             |       Oui | `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`         | Runtime tenant; ne possède aucun objet et n'est membre d'aucun rôle privilégié.                                                                                          |
| `restoplus_auth`            |       Oui | `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`         | Runtime d'authentification; ne possède aucun objet et n'est membre d'aucun rôle privilégié.                                                                              |
| `restoplus_bootstrap_owner` |       Non | `NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT` | Propriétaire de la seule fonction `restoplus_private.bootstrap_restaurant_owner`; jamais propriétaire des tables. Droits d'insertion strictement limités par ACL et RLS. |
| `restoplus_account_ops`     |       Non | `NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT` | Propriétaire des fonctions limitées de gestion des invitations, membres et état restaurant; non membre des rôles runtime. À provisionner hors bande avant migration.     |

Les trois rôles de connexion ont seulement le droit `CONNECT` sur la base. Aucun rôle ne reçoit `BYPASSRLS`. L'administrateur confirme l'absence de privilèges ou d'appartenances supplémentaires. Le migrateur est un principal DDL de confiance : son contrôle des objets lui permet de changer du DDL/policies; `FORCE ROW LEVEL SECURITY` ne protège pas contre un administrateur ou un migrateur malveillant.

Ne pas recréer à l'aveugle des rôles déjà existants. L'administrateur vérifie d'abord leur présence et leurs attributs; la migration applicative ne crée ni ne configure ces rôles. Les informations d'authentification sont définies séparément, jamais dans une commande conservée dans le dépôt.

## Propriété et privilèges attendus

### Schémas

- `public` et `restoplus_private` doivent exister avant la migration; le schéma privé appartient à `restoplus_migrator`. Cela évite d'accorder au migrateur `CREATE` sur la base uniquement pour créer un schéma. Le migrateur doit avoir `CREATE` dans `public` pour créer les tables et l'enum; tables et enum lui appartiennent après création.
- La migration crée la fonction trigger dans le schéma privé sous le migrateur, puis accorde temporairement `USAGE, CREATE` à `restoplus_bootstrap_owner` pour créer la fonction bootstrap sous son identité; elle révoque ensuite son droit `CREATE`.
- `PUBLIC`, `restoplus_app`, `restoplus_auth` et `restoplus_bootstrap_owner` n'ont pas `CREATE` dans `public`. `restoplus_app` et `restoplus_auth` ont seulement `USAGE` sur les schémas requis. Le bootstrap owner conserve `USAGE` dans `public` et le schéma privé pour sa fonction; il n'a pas `CREATE` après l'installation.
- Les privilèges par défaut et grants hérités doivent être contrôlés : le `REVOKE` de la migration ne retire pas les privilèges reçus indirectement via d'autres rôles.

### Tables et fonctions

| Principal                   | Droits directs attendus                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `restoplus_migrator`        | Propriétaire DDL des tables/type; sous `FORCE RLS`, aucune policy DML ordinaire ne lui est accordée. Une migration de données nécessite une procédure temporaire distincte approuvée.                                                                                                                                                                                          |
| `restoplus_app`             | `SELECT` sur colonnes explicitement accordées de `restaurants`, `users`, `memberships`; `UPDATE` de champs descriptifs limités. Pas d'écriture directe des rôles/statuts, invitations ou profils actifs. Exécution seulement des fonctions étroites de gestion; aucun accès `auth_credentials` ou `sessions`, aucun `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` ni DDL.      |
| `restoplus_auth`            | `SELECT` sur colonnes autorisées de `restaurants`, `users`, `auth_credentials`, `memberships`, `sessions`; `INSERT` sur colonnes limitées de `sessions`; `UPDATE(lastSeenAt, revokedAt)` sur `sessions`; `EXECUTE` sur bootstrap, inspection/acceptation d'invitation et réactivation. Aucun `INSERT/UPDATE/DELETE` direct sur les tables d'identité, aucun `DELETE` physique. |
| `restoplus_bootstrap_owner` | `INSERT` seulement sur `restaurants`, `users`, `auth_credentials`, `memberships`, `USAGE` sur l'enum de rôle et les schémas nécessaires; aucun droit de lecture, mise à jour, suppression ou contournement RLS.                                                                                                                                                                |
| `restoplus_account_ops`     | `SELECT` tenant-scoped des tables nécessaires; `INSERT`/`UPDATE` strictement limités aux colonnes de gestion et au journal; aucun `DELETE`, `TRUNCATE`, accès de connexion ou contournement RLS.                                                                                                                                                                               |
| `PUBLIC`                    | Aucun droit de table, aucun `CREATE` de schéma et aucun `EXECUTE` sur les fonctions privées.                                                                                                                                                                                                                                                                                   |

Les ACL ne remplacent pas les policies RLS. La migration active et force RLS sur les cinq tables. Le migrateur sans policy est refusé en DML; le bootstrap owner n'a que les policies d'insertion de tenant, et l'adhésion bootstrap exige `OWNER`. Les accès auth pré-session sont limités par les policies et les colonnes. Les rôles runtime doivent aussi être vérifiés contre les appartenances et ACL indirectes.

La migration crée `protect_restaurant_identity` sous le migrateur et accorde son exécution à `restoplus_app` pour le trigger. La fonction `bootstrap_restaurant_owner` appartient à `restoplus_bootstrap_owner`; son `EXECUTE` est révoqué de `PUBLIC` et accordé uniquement à `restoplus_auth`. Le corps fixe son `search_path` (`pg_catalog, pg_temp`) et qualifie les objets persistants.

## Appartenance temporaire pour `SET ROLE`

La migration contient `SET ROLE restoplus_bootstrap_owner` avant la création de la fonction bootstrap. PostgreSQL exige une appartenance permettant l'option `SET`. Cette appartenance est la seule élévation temporaire : elle ne doit autoriser ni héritage (`INHERIT`) ni administration de l'appartenance (`ADMIN`). Pour PostgreSQL 16 et plus récent, l'administrateur peut appliquer cette forme après examen des rôles :

```sql
GRANT restoplus_bootstrap_owner TO restoplus_migrator
  WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;
```

La migration doit ensuite être appliquée par le migrateur dans une fenêtre contrôlée. Elle accorde `INSERT` au bootstrap owner, lui accorde temporairement `CREATE` sur `restoplus_private`, exécute `SET ROLE`, crée la fonction, révoque `PUBLIC` de `EXECUTE`, accorde `EXECUTE` à `restoplus_auth`, exécute `RESET ROLE`, puis retire le `CREATE` temporaire du bootstrap owner. Elle ne révoque pas l'appartenance temporaire du migrateur; l'opérateur doit donc la révoquer immédiatement après la migration :

```sql
REVOKE restoplus_bootstrap_owner FROM restoplus_migrator;
```

Si l'application échoue ou s'interrompt, ne pas supposer que `RESET ROLE` ou une révocation externe a eu lieu. Fermer/abandonner la session de migration, puis depuis une session administrateur indépendante exécuter la révocation ci-dessus. Vérifier ensuite les objets partiellement créés, le statut de migration et les ACL en lecture seule; ne pas relancer la migration ni nettoyer des objets avant d'avoir compris l'état et obtenu l'approbation nécessaire. Si la révocation échoue, interrompre tout usage du migrateur et faire intervenir l'administrateur de base. L'appartenance ne doit pas être laissée active entre les étapes.

Si cette fenêtre ne peut pas être accordée, surveillée et révoquée de façon contrôlée, ne pas lancer la migration telle quelle. Faire approuver une installation alternative de la fonction par l'administrateur. Ne pas accorder `BYPASSRLS`, `SUPERUSER`, `CREATEROLE` au runtime ni rendre le bootstrap owner connectable.

## Vérifications en lecture seule

Exécuter ces requêtes uniquement avec un compte d'inspection autorisé; elles ne modifient rien et n'incluent aucun secret.

### Attributs des rôles

```sql
SELECT rolname, rolcanlogin, rolsuper, rolinherit, rolcreatedb,
       rolcreaterole, rolreplication, rolbypassrls
FROM pg_roles
WHERE rolname IN ('restoplus_migrator', 'restoplus_app',
                  'restoplus_auth', 'restoplus_bootstrap_owner')
ORDER BY rolname;
```

### Appartenances, y compris les options `SET`, `INHERIT` et `ADMIN`

```sql
SELECT parent.rolname AS granted_role, member.rolname AS member_role,
       m.inherit_option, m.set_option, m.admin_option
FROM pg_auth_members AS m
JOIN pg_roles AS parent ON parent.oid = m.roleid
JOIN pg_roles AS member ON member.oid = m.member
WHERE parent.rolname IN ('restoplus_migrator', 'restoplus_app',
                         'restoplus_auth', 'restoplus_bootstrap_owner')
   OR member.rolname IN ('restoplus_migrator', 'restoplus_app',
                         'restoplus_auth', 'restoplus_bootstrap_owner')
ORDER BY granted_role, member_role;
```

### Propriétaires des relations et des fonctions

```sql
SELECT n.nspname AS schema_name, c.relname, c.relkind,
       pg_get_userbyid(c.relowner) AS owner_name,
       c.relrowsecurity, c.relforcerowsecurity
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE (n.nspname = 'public' AND c.relname IN
       ('restaurants', 'users', 'auth_credentials', 'memberships', 'sessions'))
   OR (n.nspname = 'restoplus_private');

SELECT n.nspname, p.proname, pg_get_userbyid(p.proowner) AS owner_name,
       p.prosecdef, p.proconfig, p.proacl
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'restoplus_private';
```

### Policies, ACL de schéma et droits effectifs

```sql
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('restaurants', 'users', 'auth_credentials', 'memberships', 'sessions')
ORDER BY tablename, policyname;

SELECT nspname, nspowner::regrole AS owner_name, nspacl
FROM pg_namespace
WHERE nspname IN ('public', 'restoplus_private');

SELECT r.rolname, t.table_name,
       has_table_privilege(r.rolname, format('public.%I', t.table_name)::regclass, 'SELECT') AS can_select,
       has_table_privilege(r.rolname, format('public.%I', t.table_name)::regclass, 'INSERT') AS can_insert,
       has_table_privilege(r.rolname, format('public.%I', t.table_name)::regclass, 'UPDATE') AS can_update,
       has_table_privilege(r.rolname, format('public.%I', t.table_name)::regclass, 'DELETE') AS can_delete,
       has_table_privilege(r.rolname, format('public.%I', t.table_name)::regclass, 'TRUNCATE') AS can_truncate
FROM pg_roles AS r
CROSS JOIN (VALUES ('restaurants'), ('users'), ('auth_credentials'),
                   ('memberships'), ('sessions')) AS t(table_name)
WHERE r.rolname IN ('restoplus_migrator', 'restoplus_app',
                    'restoplus_auth', 'restoplus_bootstrap_owner')
ORDER BY r.rolname, t.table_name;

SELECT r.rolname,
       has_column_privilege(r.rolname, 'public.restaurants', 'publicCode', 'SELECT') AS can_read_public_code,
       has_column_privilege(r.rolname, 'public.auth_credentials', 'passwordHash', 'SELECT') AS can_read_password_hash,
       has_column_privilege(r.rolname, 'public.sessions', 'revokedAt', 'UPDATE') AS can_update_session_revocation
FROM pg_roles AS r
WHERE r.rolname IN ('restoplus_migrator', 'restoplus_app',
                    'restoplus_auth', 'restoplus_bootstrap_owner')
ORDER BY r.rolname;

SELECT r.rolname,
       has_schema_privilege(r.rolname, 'public', 'USAGE') AS public_usage,
       has_schema_privilege(r.rolname, 'public', 'CREATE') AS public_create,
       has_schema_privilege(r.rolname, 'restoplus_private', 'USAGE') AS private_usage,
       has_schema_privilege(r.rolname, 'restoplus_private', 'CREATE') AS private_create
FROM pg_roles AS r
WHERE r.rolname IN ('restoplus_migrator', 'restoplus_app',
                    'restoplus_auth', 'restoplus_bootstrap_owner')
ORDER BY r.rolname;

SELECT n.nspname, p.proname, COALESCE(grantee.rolname, 'PUBLIC') AS grantee,
       acl.privilege_type, acl.is_grantable
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
CROSS JOIN LATERAL aclexplode(
  COALESCE(p.proacl, acldefault('f', p.proowner))
) AS acl
LEFT JOIN pg_roles AS grantee ON grantee.oid = acl.grantee
WHERE n.nspname = 'restoplus_private'
ORDER BY p.proname, grantee;

SELECT defaclrole::regrole AS creator, defaclnamespace::regnamespace AS schema_name,
       defaclobjtype, defaclacl
FROM pg_default_acl
WHERE defaclnamespace IN ('public'::regnamespace, 'restoplus_private'::regnamespace);
```

Contrôler également les droits par colonne, `PUBLIC`, privilèges par défaut (`pg_default_acl`), les propriétaires, l'absence d'appartenances non prévues et l'ACL de fonction effective. Les contrôles catalogues sont préalables; ils ne remplacent pas les tests positifs/négatifs d'isolation sur PostgreSQL réel.

## Addendum de gestion des comptes (proposition non provisionnée)

La révision non appliquée de la migration exige le rôle supplémentaire `restoplus_account_ops`. Il doit être `NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`, propriétaire des seules fonctions de gestion définies dans le schéma privé, et ne doit être membre d'aucun rôle runtime. La migration n'inclut pas de `CREATE ROLE`; son absence est un prérequis bloquant.

Le migrateur aura besoin d'une appartenance temporaire `SET TRUE, INHERIT FALSE, ADMIN FALSE` à `restoplus_account_ops` pour créer ces fonctions sous leur propriétaire, en plus de l'appartenance temporaire existante à `restoplus_bootstrap_owner`. Cette appartenance doit être accordée par un administrateur disposant de l'option ADMIN sur chaque rôle accordé, vérifiée avant usage, puis révoquée immédiatement après la migration autorisée. Ne jamais donner l'option ADMIN au migrateur et ne laisser aucune appartenance temporaire après la fenêtre.

`restoplus_account_ops` reçoit uniquement `USAGE` de schéma, les colonnes/table nécessaires aux fonctions de gestion (lecture tenant, INSERT ciblé, UPDATE de rôle/statut, révocation logique de session et audit), et aucune suppression physique, aucun DDL durable, aucun accès direct runtime, ni `BYPASSRLS`. `CREATE` dans `restoplus_private` n'est temporaire que pendant la définition des fonctions et doit être révoqué dans la migration. Les fonctions ont un `search_path` fixé (`pg_catalog, pg_temp`), qualifient les objets persistants et retirent `EXECUTE` à `PUBLIC`.

Cette procédure est uniquement documentée. Elle ne crée pas de rôle et n'accorde aucun privilège sur l'instance existante. Les attributs, ACL et appartenance doivent être inspectés à nouveau par l'administrateur avant migration.

## Limites et exploitation

`FORCE ROW LEVEL SECURITY` soumet le propriétaire de table ordinaire aux policies, mais pas un superuser ou un rôle `BYPASSRLS`. Le migrateur est un rôle privilégié de DDL de confiance, non un rôle d'exécution applicative. Toute migration de données exige une policy et des privilèges temporaires minimaux, une approbation spécifique et une procédure de retrait vérifiée. Les fixtures doivent utiliser une base de test isolée. RLS n'est pas opérationnel tant que la migration n'est pas appliquée avec autorisation, que les privilèges effectifs ne sont pas inspectés et que les tests d'isolation ne passent pas.
