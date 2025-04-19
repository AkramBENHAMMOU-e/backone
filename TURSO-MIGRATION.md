# Guide de Migration vers Turso SQLite

Ce guide vous explique comment migrer votre application de Neon PostgreSQL vers Turso SQLite, obtenant ainsi une base de données avec **9 Go de stockage gratuit**.

## Pourquoi Turso ?

- **Plan gratuit généreux** : 9 Go de stockage (18x plus que Neon/Supabase)
- **Pas de limites sur le nombre de lignes**
- **Jusqu'à 2 000 000 de requêtes par jour** dans le plan gratuit
- **Edge-ready** : faible latence, fonctionne bien avec Vercel
- **Compatible SQLite** : simplicité, robustesse, performance

## Prérequis

1. [Créer un compte Turso](https://turso.tech/sign-up)
2. Installer la CLI Turso : `curl -sSfL https://get.tur.so/install.sh | bash`
3. Se connecter : `turso auth login`

## Étapes d'installation

### 1. Créer une base de données Turso

```bash
# Création d'une base de données
turso db create sportmaroc-db

# Obtenir l'URL de connexion
turso db show sportmaroc-db --url

# Générer un token d'authentification
turso db tokens create sportmaroc-db
```

### 2. Configurer les variables d'environnement

Créez ou mettez à jour votre fichier `.env` :

```
# Configuration Turso
TURSO_DATABASE_URL="libsql://votre-base-de-donnees.turso.io"
TURSO_AUTH_TOKEN="votre-token-auth"

# Configuration du serveur
PORT=5000
NODE_ENV=development

# Configuration de session
SESSION_SECRET=your-session-secret

# Cloudinary (inchangé)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### 3. Installation des dépendances

Pour installer les dépendances nécessaires pour Turso :

```bash
npm install @libsql/client drizzle-orm
```

### 4. Initialisation de la base de données

Suivez ces étapes pour initialiser la base de données :

```bash
# Créer les tables
npm run db:push

# Si vous avez des données à migrer depuis PostgreSQL
npm run db:migrate

# OU initialiser avec des données de test
npm run db:seed
```

## Structure des fichiers

Ce projet utilise la structure suivante pour l'accès à la base de données :

- `db/index.ts` : Configuration du client Turso et Drizzle
- `db/schema.ts` : Définition du schéma de la base de données
- `storage-turso.ts` : Implémentation du stockage avec Turso
- `auth.ts` : Authentification adaptée pour Turso

## Migration depuis PostgreSQL

Si vous migrez depuis PostgreSQL, nous avons fourni un script dans `db/migrate.ts` qui :

1. Extrait les données de votre ancienne base PostgreSQL
2. Crée une sauvegarde de vos données
3. Importe ces données dans Turso
4. Gère les différences de types entre PostgreSQL et SQLite

Pour lancer la migration, ajoutez l'URL de votre ancienne base dans `.env` :

```
OLD_DATABASE_URL="postgresql://user:password@host/database"
```

Puis exécutez :

```bash
npm run db:migrate
```

## Particularités de Turso/SQLite à noter

- SQLite utilise des entiers pour les booléens (0 = false, 1 = true)
- Les dates sont stockées comme texte au format ISO
- SQLite n'a pas de types JSON natifs (nous utilisons du texte)
- Turso supporte les transactions mais avec une syntaxe légèrement différente

## Déploiement sur Vercel

Turso fonctionne parfaitement avec Vercel. Assurez-vous d'ajouter les variables d'environnement dans les paramètres de votre projet Vercel :

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `SESSION_SECRET`
- Les variables Cloudinary habituelles

## Dépannage

Si vous rencontrez des problèmes :

1. Vérifiez la connexion à Turso : `npx tsx db/index.ts`
2. Consultez les journaux d'erreur de Vercel
3. Vous pouvez explorer vos données avec la console Turso : `turso db shell sportmaroc-db`
4. Assurez-vous que votre version de Node.js est compatible (v16+)

## Assistance supplémentaire

Pour plus d'informations, consultez :
- [Documentation Turso](https://docs.turso.tech)
- [Documentation Drizzle ORM](https://orm.drizzle.team)
- [Exemples Turso avec Vercel](https://github.com/turso-extended/app-turso-vercel-starter) 