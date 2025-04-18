# SportMarocShop Backend

Ce répertoire contient le backend de l'application SportMarocShop, une plateforme e-commerce pour la vente de produits sportifs au Maroc.

## Structure du projet

- `index.ts` - Point d'entrée de l'application
- `auth.ts` - Gestion de l'authentification avec Passport.js
- `db.ts` - Configuration de la connexion à la base de données
- `routes.ts` - Définition des points d'API REST
- `storage.ts` et `storage-db.ts` - Interface et implémentation du stockage des données
- `vite.ts` - Configuration pour le serveur de développement
- `shared/` - Types et schémas partagés entre frontend et backend

## Technologies utilisées

- Node.js avec Express
- TypeScript
- PostgreSQL avec Drizzle ORM
- Passport.js pour l'authentification
- Cloudinary pour le stockage d'images
- Stripe pour les paiements

## Installation

```bash
# Installer les dépendances
npm install

# Configuration de la base de données
npm run db:push
```

## Développement

```bash
# Démarrer le serveur de développement
npm run dev
```

## Production

```bash
# Construire pour la production
npm run build

# Démarrer en production
npm run start
```

## Variables d'environnement

Créez un fichier `.env` à la racine du projet avec les variables suivantes:

```
DATABASE_URL=postgres://user:password@host:port/dbname
SESSION_SECRET=votre_secret_session
CLOUDINARY_CLOUD_NAME=votre_cloud_name
CLOUDINARY_API_KEY=votre_api_key
CLOUDINARY_API_SECRET=votre_api_secret
STRIPE_SECRET_KEY=votre_clé_secrète_stripe
``` 