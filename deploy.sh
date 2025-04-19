#!/bin/bash

# Script de déploiement pour Vercel
# Ce script prépare l'application pour le déploiement sur Vercel

echo "===== PRÉPARATION DU DÉPLOIEMENT POUR VERCEL ====="

# Vérifier que les fichiers requis existent
if [ ! -f "vercel.json" ]; then
  echo "❌ Erreur: Le fichier vercel.json n'existe pas!"
  exit 1
fi

if [ ! -f "index.ts" ]; then
  echo "❌ Erreur: Le fichier index.ts n'existe pas!"
  exit 1
fi

# Vérifier que les scripts de build existent
if [ ! -f "vercel-build.js" ]; then
  echo "❌ Erreur: Le fichier vercel-build.js n'existe pas!"
  exit 1
fi

echo "✅ Vérification des fichiers de base: OK"

# Compiler les fichiers TypeScript avec extensions
echo "🔄 Compilation de index.ts..."
npx esbuild index.ts --platform=node --packages=external --format=esm --outdir=dist
echo "✅ Compilation de index.ts terminée"

echo "🔄 Compilation de db/schema.ts..."
npx esbuild db/schema.ts --platform=node --packages=external --format=esm --outdir=dist/db
echo "✅ Compilation de db/schema.ts terminée"

echo "🔄 Compilation de db/index.ts..."
npx esbuild db/index.ts --platform=node --packages=external --format=esm --outdir=dist/db
echo "✅ Compilation de db/index.ts terminée"

echo "🔄 Compilation de vite.js..."
npx esbuild vite.js --platform=node --packages=external --format=esm --outdir=dist
echo "✅ Compilation de vite.js terminée"

echo "🔄 Compilation de dist-fallback.js..."
npx esbuild dist-fallback.js --platform=node --packages=external --format=esm --outdir=dist
echo "✅ Compilation de dist-fallback.js terminée"

# Vérifier les fichiers générés
echo "🔍 Vérification des fichiers générés..."
if [ ! -f "dist/index.js" ]; then
  echo "⚠️ Avertissement: Le fichier dist/index.js n'a pas été généré!"
fi

if [ ! -f "dist/db/schema.js" ]; then
  echo "⚠️ Avertissement: Le fichier dist/db/schema.js n'a pas été généré!"
fi

if [ ! -f "dist/db/index.js" ]; then
  echo "⚠️ Avertissement: Le fichier dist/db/index.js n'a pas été généré!"
fi

echo "✅ Génération des fichiers terminée"

# Exécuter le script de construction Vercel
echo "🔄 Exécution du script vercel-build.js..."
node vercel-build.js
echo "✅ Script vercel-build.js exécuté"

echo "===== DÉPLOIEMENT PRÊT ====="
echo "Vous pouvez maintenant déployer l'application sur Vercel avec la commande:"
echo "vercel --prod" 