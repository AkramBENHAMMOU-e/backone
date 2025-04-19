import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Utilisation de ESM pour le support des modules
import 'dotenv/config';

const runMigration = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL n\'est pas défini dans les variables d\'environnement');
  }

  console.log('Exécution des migrations sur:', process.env.DATABASE_URL);
  
  try {
    // Connexion en utilisant postgres-js
    const connection = postgres(process.env.DATABASE_URL, { max: 1 });
    const db = drizzle(connection);
    
    // Exécution des migrations
    console.log('Démarrage des migrations...');
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('Migrations terminées avec succès !');
    
    // Fermeture de la connexion
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('Erreur pendant les migrations:', error);
    process.exit(1);
  }
};

// Exécution de la fonction principale
runMigration(); 