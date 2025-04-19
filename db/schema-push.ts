import { migrate } from 'drizzle-orm/libsql/migrator';
import { db, tursoClient } from './index';
import * as schema from './schema';

async function main() {
  console.log('🔍 Vérification de la connexion à Turso...');
  
  try {
    // Test de connexion
    const result = await tursoClient.execute('SELECT 1 as test');
    console.log('✅ Connexion à Turso réussie:', result);
    
    // Créer les tables définies dans le schéma
    console.log('🚀 Création des tables...');
    
    // Créer les tables une par une au lieu d'utiliser batch
    console.log('  Création de la table users...');
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        phone_number TEXT,
        address TEXT,
        is_admin INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('  Création de la table products...');
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        price INTEGER NOT NULL,
        image_url TEXT NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        featured INTEGER DEFAULT 0,
        discount INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('  Création de la table orders...');
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        status TEXT NOT NULL DEFAULT 'pending',
        total_amount INTEGER NOT NULL,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        shipping_address TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('  Création de la table order_items...');
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price_at_purchase INTEGER NOT NULL
      )
    `);
    
    console.log('  Création de la table sessions...');
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL,
        data TEXT NOT NULL
      )
    `);
    
    console.log('  Création de la table cart_items...');
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Création des tables terminée avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de la création des tables:', error);
    process.exit(1);
  } finally {
    // Fermer la connexion
    await tursoClient.close();
  }
}

main(); 