# Routes API

Les routes de gestion des membres et de réactivation du restaurant valident l'origine, la session serveur quand elle s'applique, les permissions et les données avec Zod. Le tenant vient exclusivement de la session validée. `APP_DATABASE_URL` et `AUTH_DATABASE_URL` restent séparés. L'acceptation d'invitation se fait par token à forte entropie; le token brut n'est remis qu'une fois à l'OWNER/MANAGER créateur, car aucun service d'e-mail n'est configuré. Les réponses sensibles sont `no-store`.

`/api/menu` lit le catalogue du tenant depuis la base. Les écritures catégories/produits sont réservées à OWNER/MANAGER; l'action disponibilité accepte aussi KITCHEN. Les mutations valident l'origine et le schéma Zod. Le navigateur transmet des identifiants/options, jamais des prix, devises ou postes de préparation. La migration catalogue est candidate et non exécutée; voir `docs/catalog-persistence-design.md`.
