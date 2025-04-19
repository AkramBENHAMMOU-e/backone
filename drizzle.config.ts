import { defineConfig } from "drizzle-kit";
import 'dotenv/config';

// Vérifier que DATABASE_URL est défini
if (!process.env.TURSO_DATABASE_URL) {
  throw new Error("TURSO_DATABASE_URL n'est pas défini, assurez-vous que la base de données est provisionnée");
}

// Configuration pour Turso
export default defineConfig({
  schema: './db/schema.ts',
  driver: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
  verbose: true,
  strict: true,
});
