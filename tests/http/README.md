# Plan de tests HTTP de bout en bout

## Portée et état

La suite exécutable `security.test.mjs` utilise `node:test`, `fetch` et le client `pg` déjà présent dans le projet. Elle couvre l’authentification et les attributs du cookie, les refus d’origine et de validation pour la réactivation, l’accès aux membres, l’isolation d’un tenant, les refus de promotion MANAGER, l’acceptation/rejeu d’invitation, la révocation de session et le refus de désactivation du restaurant par MANAGER. Elle ne remplace pas les tests PostgreSQL d’ACL, RLS et concurrence. Aucun test HTTP n’a été exécuté pendant sa préparation.

La suite Commandes de cette phase exige exclusivement `restoplus_test_disposable`, des comptes synthétiques déjà préparés et une confirmation explicite. Elle vérifie les rôles `restoplus_app` et `restoplus_auth` ainsi que l’identité de la base via les URL de test. Le serveur Next.js doit être lancé avec les mêmes connexions de test; le contrôle côté test ne peut pas inspecter l’environnement d’un serveur déjà lancé. Ne jamais utiliser `restoplus_dev`, afficher une URL de connexion ou imprimer un cookie, un mot de passe ou un jeton.

## Préparer une base jetable (commandes proposées, non exécutées)

Les rôles PostgreSQL sont globaux à l’instance, pas propres à une base. La création de cette base ne crée donc aucun rôle et ne rend pas `restoplus_account_ops` disponible. Cette suite ne doit pas être lancée avant que les rôles et privilèges nécessaires aient été provisionnés séparément, sur une instance de test approuvée. Ne pas réutiliser `restoplus_dev`.

Depuis PowerShell, ouvrir une session d’administration interactive sur la base système `postgres` :

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -W -U postgres -d postgres
```

Dans `psql`, après vérification de `current_database()` et de l’identité administrative, créer seulement la base jetable (adapter son suffixe pour qu’il soit unique) :

```sql
CREATE DATABASE restoplus_test_20261020
  WITH OWNER = restoplus_migrator
       TEMPLATE = template0
       ENCODING = 'UTF8';
```

Si PostgreSQL refuse le propriétaire ou si le rôle administrateur ne peut pas créer la base, s’arrêter et faire provisionner la base par l’administrateur. Ne pas tenter de corriger les appartenances ou privilèges dans cette étape. Avant tout usage ultérieur, vérifier en lecture seule que la base est exactement `restoplus_test_disposable`, que son propriétaire est attendu et que `restoplus_dev` n’a pas été ciblée. La préparation des schémas, des rôles, des appartenances temporaires et toute migration nécessitent des autorisations distinctes.

Après création, vérifier l’identité et l’état des schémas en lecture seule :

```sql
SELECT current_database() AS database_name,
       pg_get_userbyid(datdba) AS database_owner
FROM pg_database
WHERE datname = current_database();

SELECT nspname AS schema_name,
       nspowner::regrole AS schema_owner,
       nspacl
FROM pg_namespace
WHERE nspname IN ('public', 'restoplus_private')
ORDER BY nspname;
```

La migration exige que `public` et `restoplus_private` existent et appartiennent à `restoplus_migrator`. Sur une base neuve, ne supposez pas que le propriétaire initial de `public` satisfait cette condition. Toute préparation ou correction de propriétaire de schéma doit être examinée et autorisée séparément avant la migration.

## Variables locales de test

Fournir ces variables uniquement dans l’environnement local, sans les enregistrer dans le dépôt, les arguments de commande ou les journaux. Dans les deux fenêtres PowerShell, `APP_DATABASE_URL` doit être égal à `RESTOPLUS_TEST_APP_DATABASE_URL`, et `AUTH_DATABASE_URL` égal à `RESTOPLUS_TEST_AUTH_DATABASE_URL` :

- `RESTOPLUS_HTTP_TEST_CONFIRMATION=isolated-disposable`
- `RESTOPLUS_HTTP_BASE_URL=http://127.0.0.1:3000`
- `RESTOPLUS_TEST_APP_DATABASE_URL` et `RESTOPLUS_TEST_AUTH_DATABASE_URL` vers la même base jetable
- `APP_DATABASE_URL` et `AUTH_DATABASE_URL` vers les mêmes connexions isolées, pour le serveur Next.js
- `RESTOPLUS_HTTP_OWNER_A_CODE`, `RESTOPLUS_HTTP_OWNER_A_EMAIL`, `RESTOPLUS_HTTP_OWNER_A_PASSWORD`
- `RESTOPLUS_HTTP_MANAGER_A_CODE`, `RESTOPLUS_HTTP_MANAGER_A_EMAIL`, `RESTOPLUS_HTTP_MANAGER_A_PASSWORD`
- `RESTOPLUS_HTTP_WAITER_A_CODE`, `RESTOPLUS_HTTP_WAITER_A_EMAIL`, `RESTOPLUS_HTTP_WAITER_A_PASSWORD`, `RESTOPLUS_HTTP_WAITER_A_DISPLAY_NAME`
- `RESTOPLUS_HTTP_OWNER_A_USER_ID` et `RESTOPLUS_HTTP_OWNER_B_USER_ID`, pour les protections du dernier OWNER et du tenant B
- `RESTOPLUS_HTTP_TENANT_B_DISPLAY_NAME`, pour le test inter-tenant

Les restaurants A et B doivent exister dans la base jetable; A doit contenir un OWNER, un MANAGER et un membre opérationnel. Les marqueurs de nom doivent être distincts. Le propriétaire B doit être un UUID valide. Les mots de passe et codes sont lus par le processus mais ne sont jamais inclus dans les messages d’échec.

Dans une première fenêtre PowerShell, injecter `APP_DATABASE_URL` et `AUTH_DATABASE_URL` avec les connexions de la base de test depuis le canal local de secrets, puis démarrer :

```powershell
npm run dev
```

Dans une seconde fenêtre PowerShell, fournir les variables de test ci-dessus et exécuter :

```powershell
npm run test:http:security
```

Le test échoue avant les requêtes HTTP si la confirmation manque, si l’URL HTTP n’est pas loopback, si la base n’a pas le préfixe `restoplus_test_`, si les rôles de connexion ne sont pas ceux attendus ou si les deux URL pointent vers des bases différentes. Les tests d’invitation créent un compte synthétique; supprimer la base jetable ne doit faire l’objet que d’une autorisation ultérieure distincte.

## Préparation du scénario

Préparer deux restaurants A et B avec leurs propriétaires actifs, un MANAGER, un membre opérationnel, un second OWNER dans A pour les tests de dernier propriétaire, ainsi que des invitations valides, expirées, annulées et déjà consommées. Garder les identifiants synthétiques dans le processus de test; ne pas les enregistrer dans le dépôt.

Utiliser `node:test` pour démarrer les requêtes HTTP vers un serveur Next.js local et `fetch` pour appeler les routes. Envoyer un en-tête `Origin` égal à l’origine du serveur pour les écritures légitimes et une origine différente pour les tests CSRF. Conserver le cookie renvoyé par le login et le présenter explicitement dans les requêtes suivantes. Le test ne doit pas suivre aveuglément les redirections ni imprimer les valeurs de cookies ou les tokens.

## Matrice HTTP d’acceptation

| Route/scénario                                                                                                   | Résultat attendu                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/login`, corps invalide, JSON mal formé ou origine absente/étrangère                              | `400` pour l’entrée invalide, `403` pour l’origine refusée; aucun cookie de session                                                                      |
| Login avec code, e-mail ou mot de passe incorrect                                                                | Réponse générique `401`, sans révéler lequel des champs est incorrect; réponse `no-store`                                                                |
| Login avec restaurant ou compte inactif                                                                          | Même refus générique; aucune session créée                                                                                                               |
| Login valide                                                                                                     | `200`, cookie opaque `HttpOnly`, `SameSite=Lax`, `Path=/`, durée absolue maximale 12 h; `Secure` en production; réponse sans cache                       |
| Login répété au-delà du seuil configuré                                                                          | La sixième tentative avec la même clé normalisée obtient `429`; ne pas afficher la clé hachée                                                            |
| `POST /api/auth/logout` sans session ou avec session                                                             | `200`; avec session, révocation côté serveur et suppression du cookie; un ancien cookie échoue à la prochaine validation                                 |
| `GET /api/members` sans session                                                                                  | `401`                                                                                                                                                    |
| `GET /api/members` avec OWNER ou MANAGER actif de A                                                              | `200`; ne contient que les profils et adhésions du restaurant A                                                                                          |
| `GET /api/members` avec rôle opérationnel                                                                        | `403`                                                                                                                                                    |
| `POST /api/members` depuis une origine étrangère ou avec rôle non gérant                                         | `403`; aucune invitation créée                                                                                                                           |
| Invitation avec entrée invalide ou rôle `OWNER`                                                                  | `400`; aucune invitation créée                                                                                                                           |
| Invitation valide par OWNER ou MANAGER                                                                           | `201`; rôle différent de OWNER, expiration présente, token remis une seule fois dans la réponse; ne jamais enregistrer ce token dans les journaux        |
| `GET /api/members/invitations` avec OWNER/MANAGER et sans session                                                | Respectivement `200` limité au tenant ou `401`; rôle opérationnel `403`                                                                                  |
| `DELETE /api/members/invitations/{id}`                                                                           | Annulation réussie seulement pour une invitation du tenant; identifiant invalide `400`; invitation étrangère/inexistante refusée sans fuite inter-tenant |
| Acceptation d’invitation valide                                                                                  | `200`; création atomique du profil, du credential, de l’adhésion et consommation de l’invitation; nouvelle session créée après le commit                 |
| Invitation expirée, annulée, consommée, d’un restaurant inactif ou acceptée deux fois en concurrence             | Refus générique; aucune création partielle; au plus une acceptation réussit                                                                              |
| `PATCH /api/members/{userId}` sans session, avec origine étrangère, UUID invalide, JSON invalide ou corps vide   | `401`, `403` ou `400` approprié; aucun changement                                                                                                        |
| MANAGER change un rôle opérationnel ou un statut autorisé                                                        | Réussite pour un membre de son restaurant; aucune modification d’un OWNER                                                                                |
| MANAGER attribue OWNER, OWNER s’auto-promut, ou un utilisateur change son propre rôle en OWNER                   | `403` ou refus métier; aucun changement                                                                                                                  |
| OWNER promeut un autre membre actif en OWNER                                                                     | Réussite; le nouveau rôle est visible à la validation de session suivante                                                                                |
| Promotion d’un membre inactif, cible d’un autre tenant ou identifiant inconnu                                    | Refus sans accès ni changement croisé                                                                                                                    |
| Désactivation/démotion du dernier OWNER actif                                                                    | `409`; l’adhésion et le profil restent actifs                                                                                                            |
| Désactivation d’un membre par MANAGER ou OWNER                                                                   | Sessions ciblées révoquées dans la même transaction; les requêtes suivantes avec l’ancien cookie sont refusées                                           |
| `POST /api/restaurant/deactivate` par MANAGER ou sans session                                                    | `403` ou `401`; aucune désactivation                                                                                                                     |
| Désactivation par OWNER actif                                                                                    | `200`; restaurant désactivé, sessions révoquées et cookie effacé                                                                                         |
| `POST /api/auth/reactivate-restaurant` avec origine étrangère, mauvais mot de passe, non-OWNER ou compte inactif | `403` ou réponse générique `401/409`; restaurant reste inactif, pas de session                                                                           |
| Réactivation avec code/e-mail/mot de passe corrects d’un OWNER actif                                             | `200`; restaurant réactivé, anciennes sessions restent révoquées, une nouvelle session est créée après la transaction de réactivation                    |
| Requêtes déjà engagées pendant une révocation                                                                    | La requête déjà engagée peut se terminer; chaque validation ultérieure de session doit refuser le cookie révoqué                                         |

## Contrôles transversaux

- Pour chaque route protégée, modifier uniquement un paramètre `restaurantId` forgé dans la requête ne change jamais le tenant : celui-ci provient du contexte de session validé.
- Vérifier l’en-tête `Cache-Control: no-store` sur les réponses d’authentification et de données sensibles.
- Vérifier l’absence de réponse contenant le hash du mot de passe, l’empreinte du token de session, ou les détails d’erreur SQL.
- Vérifier que les erreurs de compte, de mot de passe et de tenant ne permettent pas d’énumérer les comptes.
- Exécuter les variantes parallèles d’acceptation d’une invitation et de démotion OWNER contre les tests PostgreSQL, qui sont la preuve de l’atomicité et des verrous; un test HTTP séquentiel ne suffit pas.
- Vérifier au niveau PostgreSQL que `restoplus_app` ne peut pas lire credentials/sessions ni exécuter les DML sensibles directement. Les tests HTTP seuls ne prouvent pas les privilèges RLS.

## Limites connues à traiter

- Le limiteur actuel est en mémoire du processus et partagé seulement par login et réactivation. Il ne protège pas contre les tentatives distribuées, plusieurs instances ou redémarrages; un contrôle partagé de production reste requis.
- L’acceptation d’invitation n’a pas de limiteur de tentatives dédié. Le token aléatoire de 256 bits rend la découverte par force brute impraticable, mais l’absence de limiteur et de journalisation d’abus doit être réévaluée avant production.
- Aucun fournisseur d’e-mail n’est configuré. Le token d’invitation est retourné à l’appelant autorisé; l’intégration et le canal de remise restent à décider.
- Aucun handler HTTP d’inscription/bootstrap du premier OWNER n’est présent dans les routes recensées. Le flux SQL atomique existe, mais le parcours HTTP de création initiale doit être spécifié avant l’onboarding réel d’un restaurant.
- La durée d’invitation de sept jours est un défaut technique documenté, à confirmer avant production.
- Le cookie `Secure` dépend de `NODE_ENV=production`; le test de production doit vérifier cette configuration derrière le proxy TLS réel.

## Exécution future des tests PostgreSQL

1. Confirmer que l’instance est jetable et distincte de `restoplus_dev`, puis configurer les URL de test localement sans les copier dans les arguments, les journaux ou le dépôt.
2. Préparer les fixtures avec les procédures autorisées et appliquer la migration uniquement sur la base jetable.
3. Démarrer Next.js avec l’environnement de test, exécuter la suite `node:test` HTTP et collecter uniquement les statuts, assertions et identifiants synthétiques nécessaires.
4. Exécuter en parallèle les tests PostgreSQL d’isolation, de privilèges et de concurrence.
5. Révoquer les sessions et invitations de test; conserver ou supprimer la base jetable uniquement après confirmation de son identité et selon une autorisation dédiée.

La migration de développement ne doit être envisagée qu’après réussite des tests HTTP et PostgreSQL, résolution des prérequis de rôles, et audit en lecture seule de `restoplus_dev`.
