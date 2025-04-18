import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Définir directement l'URL de la base de données en cas d'absence de variable d'environnement
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_GkyWtclF76xe@ep-muddy-scene-a2dyqp50-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";

// Configurer le pool avec des options de gestion d'erreurs et de timeout
export const pool = new Pool({ 
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Ajouter un gestionnaire d'erreurs pour le pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
  process.exit(-1);
});

export const db = drizzle(pool, { schema });

// Fonction pour tester la connexion à la base de données
export async function testConnection() {
  try {
    const client = await pool.connect();
    client.release();
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
}