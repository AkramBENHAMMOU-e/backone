import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import ws from "ws";
import * as schema from "@shared/schema";

// Configuration WebSocket pour Neon Database en environnement serverless
neonConfig.webSocketConstructor = ws;
neonConfig.fetchConnectionCache = true;

// Définir directement l'URL de la base de données en cas d'absence de variable d'environnement
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_GkyWtclF76xe@ep-muddy-scene-a2dyqp50-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";

// Utiliser la connexion HTTP au lieu de Pool pour meilleure compatibilité avec Vercel
const sql = neon(DATABASE_URL);
export const db = drizzle(sql, { schema });

// Fonction pour tester la connexion à la base de données
export async function testConnection() {
  try {
    // Exécuter une requête simple pour vérifier la connexion
    const result = await sql`SELECT 1 as connection_test`;
    console.log('Database connection successful', result);
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
}