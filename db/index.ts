import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.js';

// Charger les variables d'environnement
import 'dotenv/config';

// Vérifier la configuration
if (!process.env.TURSO_DATABASE_URL) {
  throw new Error('TURSO_DATABASE_URL est requis');
}

// Configuration du client
const clientOptions = {
  url: process.env.TURSO_DATABASE_URL,
  ...(process.env.TURSO_AUTH_TOKEN
    ? { authToken: process.env.TURSO_AUTH_TOKEN }
    : {})
};

// Création du client Turso
export const tursoClient = createClient(clientOptions);

// Création du client Drizzle
export const db = drizzle(tursoClient, { schema });

// Fonction de test de connexion
export async function testConnection() {
  try {
    const result = await tursoClient.execute('SELECT 1 as connection_test');
    console.log('Connexion à Turso réussie:', result);
    return true;
  } catch (error) {
    console.error('Erreur de connexion à Turso:', error);
    return false;
  }
} 