// Stub file pour remplacer le fichier vite.js supprimé
// Ceci est nécessaire car le fichier index.ts importe encore ces fonctions

import express from 'express';
import path from 'path';

// Fonction de log simplifiée
export function log(message) {
  console.log(message);
}

// Fonction stub pour setupVite (non utilisée en production)
export function setupVite(app, server) {
  console.log('Vite setup function called but not implemented in production');
}

// Fonction pour servir des fichiers statiques
export function serveStatic(app) {
  // En production, servir l'API uniquement
  console.log('Static files serving not needed in API-only mode');
} 