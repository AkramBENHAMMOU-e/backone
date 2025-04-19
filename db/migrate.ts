import { db, tursoClient } from './index';
import * as schema from './schema';
import postgres from 'postgres';
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuration pour obtenir le chemin du dossier
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tables à migrer
const tables = ['users', 'products', 'orders', 'order_items'];

async function main() {
  console.log('🚀 Démarrage de la migration des données vers Turso...');
  
  // Vérifier la présence des variables d'environnement
  if (!process.env.OLD_DATABASE_URL) {
    console.error('❌ Variable OLD_DATABASE_URL non définie');
    console.log('💡 Ajoutez OLD_DATABASE_URL=votre_ancien_url dans le fichier .env');
    return;
  }
  
  let pgClient;
  try {
    // Créer une connexion à l'ancienne base PostgreSQL
    console.log('🔌 Connexion à l\'ancienne base PostgreSQL...');
    pgClient = postgres(process.env.OLD_DATABASE_URL);
    
    // Dossier de sauvegarde
    const backupDir = path.join(__dirname, '..', 'backup');
    await fs.mkdir(backupDir, { recursive: true });
    
    // Pour chaque table
    for (const table of tables) {
      console.log(`\n📋 Migration de la table: ${table}`);
      
      try {
        // 1. Extraction des données depuis PostgreSQL
        console.log(`  📤 Extraction des données depuis PostgreSQL...`);
        const records = await pgClient`SELECT * FROM ${pgClient(table)}`;
        console.log(`  ✅ ${records.length} enregistrements extraits`);
        
        // Sauvegarde des données
        const backupFile = path.join(backupDir, `${table}_backup.json`);
        await fs.writeFile(backupFile, JSON.stringify(records, null, 2));
        console.log(`  💾 Sauvegarde effectuée dans ${backupFile}`);
        
        if (records.length === 0) {
          console.log(`  ⏩ Table vide, passage à la suivante`);
          continue;
        }
        
        // 2. Insertion dans Turso
        console.log(`  📥 Insertion des données dans Turso...`);
        
        // Vider la table dans Turso
        await tursoClient.execute(`DELETE FROM ${table}`);
        
        // Pour les tables avec auto-increment, réinitialiser le compteur
        if (['users', 'products', 'orders', 'order_items'].includes(table)) {
          await tursoClient.execute(`DELETE FROM sqlite_sequence WHERE name = '${table}'`);
        }
        
        // Construire des requêtes d'insertion par lots
        const chunkSize = 50;
        const chunks = [];
        
        for (let i = 0; i < records.length; i += chunkSize) {
          chunks.push(records.slice(i, i + chunkSize));
        }
        
        let totalInserted = 0;
        
        for (const chunk of chunks) {
          const batch = [];
          
          for (const record of chunk) {
            // Adaptation des données pour SQLite
            const sanitizedRecord = {};
            
            for (const [key, value] of Object.entries(record)) {
              // Conversion des booléens en entiers pour SQLite
              if (typeof value === 'boolean') {
                sanitizedRecord[key] = value ? 1 : 0;
              } 
              // Conversion des dates en chaînes ISO
              else if (value instanceof Date) {
                sanitizedRecord[key] = value.toISOString();
              }
              // Autres types restent inchangés
              else {
                sanitizedRecord[key] = value;
              }
            }
            
            // Construire la requête d'insertion
            const columns = Object.keys(sanitizedRecord).map(k => 
              k === 'createdAt' ? 'created_at' : 
              k === 'updatedAt' ? 'updated_at' : 
              k === 'userId' ? 'user_id' :
              k === 'orderId' ? 'order_id' :
              k === 'productId' ? 'product_id' :
              k === 'fullName' ? 'full_name' :
              k === 'phoneNumber' ? 'phone_number' :
              k === 'imageUrl' ? 'image_url' :
              k === 'totalAmount' ? 'total_amount' :
              k === 'customerName' ? 'customer_name' :
              k === 'customerEmail' ? 'customer_email' :
              k === 'customerPhone' ? 'customer_phone' :
              k === 'shippingAddress' ? 'shipping_address' :
              k === 'priceAtPurchase' ? 'price_at_purchase' :
              k === 'isAdmin' ? 'is_admin' : k
            );
            
            const values = Object.values(sanitizedRecord);
            const placeholders = values.map(() => '?').join(', ');
            
            const query = `
              INSERT INTO ${table} (${columns.join(', ')})
              VALUES (${placeholders})
            `;
            
            batch.push(tursoClient.execute({
              sql: query,
              args: values
            }));
          }
          
          // Exécuter le lot
          await Promise.all(batch);
          totalInserted += chunk.length;
          console.log(`  ⏱️ ${totalInserted}/${records.length} enregistrements insérés`);
        }
        
        console.log(`  ✅ Migration de ${table} terminée avec succès`);
      } catch (error) {
        console.error(`  ❌ Erreur lors de la migration de ${table}:`, error);
      }
    }
    
    console.log('\n🎉 Migration terminée !');
    
  } catch (error) {
    console.error('❌ Erreur de migration:', error);
  } finally {
    // Fermer les connexions
    if (pgClient) await pgClient.end();
    await tursoClient.close();
  }
}

main(); 