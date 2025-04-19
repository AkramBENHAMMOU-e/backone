/**
 * Script de préparation pour le déploiement Vercel
 * Ce script s'assure que tous les fichiers nécessaires sont copiés et les répertoires créés
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== DÉBUT DE LA PRÉPARATION POUR VERCEL ===');

// S'assurer que nous sommes dans le bon répertoire
const projectRoot = __dirname;
console.log(`Répertoire racine du projet: ${projectRoot}`);

// Fonction pour créer un répertoire s'il n'existe pas
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Répertoire créé: ${dirPath}`);
  } else {
    console.log(`ℹ️ Répertoire existe déjà: ${dirPath}`);
  }
}

// Fonction pour copier un fichier
function copyFile(src, dest) {
  try {
    fs.copyFileSync(src, dest);
    console.log(`✅ Fichier copié: ${src} -> ${dest}`);
  } catch (error) {
    console.error(`❌ Erreur lors de la copie de ${src} vers ${dest}:`, error.message);
  }
}

// Fonction pour compiler un fichier TS en JS
function compileFile(file) {
  try {
    console.log(`🔄 Compilation de ${file}...`);
    execSync(`npx esbuild ${file} --platform=node --packages=external --format=esm --outfile=${file.replace('.ts', '.js')}`);
    console.log(`✅ Compilation réussie: ${file}`);
    return true;
  } catch (error) {
    console.error(`❌ Erreur lors de la compilation de ${file}:`, error.message);
    return false;
  }
}

// Créer les répertoires nécessaires
ensureDir(path.join(projectRoot, 'dist'));
ensureDir(path.join(projectRoot, 'dist/db'));

// Liste des fichiers TS à compiler
const filesToCompile = [
  'db/schema.ts',
  'db/index.ts',
];

// Compiler les fichiers TS
console.log('\n=== COMPILATION DES FICHIERS TS ===');
filesToCompile.forEach(file => {
  const fullPath = path.join(projectRoot, file);
  if (fs.existsSync(fullPath)) {
    compileFile(fullPath);
  } else {
    console.warn(`⚠️ Le fichier ${fullPath} n'existe pas.`);
  }
});

// Copier les fichiers compilés vers le répertoire dist
console.log('\n=== COPIE DES FICHIERS VERS DIST ===');
filesToCompile.forEach(file => {
  const srcFile = path.join(projectRoot, file.replace('.ts', '.js'));
  const destFile = path.join(projectRoot, 'dist', file.replace('.ts', '.js'));
  
  if (fs.existsSync(srcFile)) {
    // Créer le répertoire du fichier de destination si nécessaire
    ensureDir(path.dirname(destFile));
    copyFile(srcFile, destFile);
  } else {
    console.warn(`⚠️ Le fichier compilé ${srcFile} n'existe pas.`);
  }
});

console.log('\n=== VÉRIFICATION DE LA STRUCTURE FINALE ===');
const distDbDir = path.join(projectRoot, 'dist/db');
if (fs.existsSync(distDbDir)) {
  console.log(`📂 Contenu du répertoire ${distDbDir}:`);
  fs.readdirSync(distDbDir).forEach(file => {
    console.log(`  - ${file}`);
  });
} else {
  console.error(`❌ Le répertoire ${distDbDir} n'existe pas!`);
}

console.log('\n=== FIN DE LA PRÉPARATION POUR VERCEL ==='); 