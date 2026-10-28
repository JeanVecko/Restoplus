# Superadmin plateforme

La console superadmin est accessible sur `/admin/login`; elle ne demande pas de code restaurant. Le compte est configuré localement dans `.env`; son mot de passe est haché avec scrypt. Ne réutilisez pas le mot de passe de connexion PostgreSQL comme mot de passe superadmin.

## Compte web

Dans un terminal ouvert à la racine du projet, après avoir créé le rôle PostgreSQL ci-dessous, exécutez :

```powershell
node scripts/configure-platform-admin.mjs
```

Le script propose `jeanvecko.s@gmail.com`, masque la saisie du mot de passe et écrit uniquement son hash et une clé de session générée dans `.env`. La politique demande au moins 12 caractères. Il demande aussi le mot de passe PostgreSQL choisi à l’étape suivante et compose `PLATFORM_ADMIN_DATABASE_URL` à partir de l’hôte de `APP_DATABASE_URL`. Ces mots de passe ne sont pas affichés. Le script ne les ajoute pas au dépôt.

## Rôle PostgreSQL dédié

Dans `psql`, connecté à la base cible en tant qu’administrateur, exécutez le script d’installation :

```psql
\i 'C:/Users/ADM SGCI/Desktop/RestoPlus/scripts/provision-platform-admin.sql'
```

Il crée un rôle de connexion sans `SUPERUSER` ni `BYPASSRLS`, puis demande le mot de passe de base de données de manière interactive. Ce secret est distinct du compte web superadmin. Le script fourni cible `restoplus_test_disposable`; pour Neon ou une autre base, remplacez cette seule base par celle de destination avant exécution. Le rôle doit pointer vers la même base que `APP_DATABASE_URL` et `AUTH_DATABASE_URL`. Ne donnez jamais cette URL au navigateur.

## Migration

Une fois le rôle créé, appliquez la migration avec la configuration locale :

```powershell
npx prisma migrate deploy --schema prisma/schema.prisma
npx prisma generate
```

La migration ajoute un journal d’audit plateforme, puis accorde à `restoplus_platform_admin` un accès global aux tables opérationnelles sous RLS. Elle exclut les hashes de mots de passe (`auth_credentials`), les sessions (`sessions`) et les migrations internes. Les tables d’audit sont consultables, mais pas modifiables par ce rôle. L’application utilise cette connexion seulement dans la zone `/admin` et ses routes API protégées. Les actions disponibles dans cette première console sont la consultation globale des établissements et leur activation/désactivation, journalisées.

Pour une nouvelle table applicative ajoutée dans une migration future, ajouter explicitement une policy et les privilèges au rôle `restoplus_platform_admin`; ne pas attribuer `BYPASSRLS`.
