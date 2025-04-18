import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@shared/schema';

// Configuration pour Neon Database en environnement serverless
// Pas besoin de WebSocket pour le driver HTTP
neonConfig.fetchConnectionCache = true;

// Définir les URLs de la base de données, en favorisant les variables d'environnement
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_GkyWtclF76xe@ep-muddy-scene-a2dyqp50-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";

console.log('Connexion à la base de données avec URL:', DATABASE_URL);

let sql;
let db;

// Créer la connexion avec neon
try {
  // Utiliser la connexion HTTP pour compatibilité avec Vercel
  sql = neon(DATABASE_URL);
  db = drizzle(sql, { schema });
  console.log('Initialisation de Drizzle réussie.');
} catch (error) {
  console.error('Failed to initialize database connection:', error);
  
  // Créer une implémentation de secours pour éviter les erreurs
  const mockSql = async () => { 
    console.error('Using fallback mock database connection due to initialization error.');
    throw new Error('Database connection failed during initialization');
  };
  sql = mockSql;
  db = drizzle(mockSql as any, { schema });
}

// Fonction pour tester la connexion à la base de données
async function testConnection() {
  // Si l'initialisation a échoué, retourner false immédiatement
  if (typeof sql === 'function' && sql.toString().includes('mockSql')) {
     console.error('testConnection: Database initialization previously failed.');
     return false;
  }
  try {
    // Exécuter une requête simple pour vérifier la connexion
    const result = await sql`SELECT 1 as connection_test`;
    console.log('Database connection test successful', result);
    return true;
  } catch (error) {
    console.error('Database connection test error:', error);
    return false;
  }
}

export { db, testConnection };