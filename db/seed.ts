import { db, tursoClient } from './index';
import * as schema from './schema';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Fonction pour hacher un mot de passe
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function main() {
  console.log('🌱 Initialisation de la base de données avec des données de test...');
  
  try {
    // Vérifier si la table users existe
    const userTableExists = await tursoClient.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='users'
    `);
    
    if (userTableExists.rows.length === 0) {
      console.error('❌ La table users n\'existe pas. Exécutez d\'abord npm run db:push');
      return;
    }
    
    // 1. Vider les tables existantes
    console.log('🧹 Nettoyage des tables existantes...');
    
    console.log('  - Suppression des données de cart_items...');
    await tursoClient.execute('DELETE FROM cart_items');
    
    console.log('  - Suppression des données de order_items...');
    await tursoClient.execute('DELETE FROM order_items');
    
    console.log('  - Suppression des données de orders...');
    await tursoClient.execute('DELETE FROM orders');
    
    console.log('  - Suppression des données de products...');
    await tursoClient.execute('DELETE FROM products');
    
    console.log('  - Suppression des données de users...');
    await tursoClient.execute('DELETE FROM users');
    
    console.log('  - Suppression des données de sessions...');
    await tursoClient.execute('DELETE FROM sessions');
    
    // Réinitialiser les auto-incréments
    console.log('  - Réinitialisation des auto-incréments...');
    await tursoClient.execute(`DELETE FROM sqlite_sequence WHERE name = 'users'`);
    await tursoClient.execute(`DELETE FROM sqlite_sequence WHERE name = 'products'`);
    await tursoClient.execute(`DELETE FROM sqlite_sequence WHERE name = 'orders'`);
    await tursoClient.execute(`DELETE FROM sqlite_sequence WHERE name = 'order_items'`);
    await tursoClient.execute(`DELETE FROM sqlite_sequence WHERE name = 'cart_items'`);
    
    console.log('✅ Tables nettoyées');
    
    // 2. Créer l'utilisateur admin
    console.log('👤 Création de l\'utilisateur admin...');
    const adminPassword = await hashPassword('admin123');
    await db.insert(schema.users).values({
      username: 'admin',
      password: adminPassword,
      email: 'admin@fitmaroc.ma',
      fullName: 'Administrateur',
      isAdmin: 1
    });
    
    // 3. Créer quelques utilisateurs réguliers
    console.log('👥 Création des utilisateurs réguliers...');
    const user1Password = await hashPassword('user123');
    const user2Password = await hashPassword('user456');
    
    await db.insert(schema.users).values([
      {
        username: 'utilisateur1',
        password: user1Password,
        email: 'utilisateur1@exemple.ma',
        fullName: 'Premier Utilisateur',
        phoneNumber: '0612345678',
        address: '123 Rue des Exemples, Casablanca',
        isAdmin: 0
      },
      {
        username: 'utilisateur2',
        password: user2Password,
        email: 'utilisateur2@exemple.ma',
        fullName: 'Deuxième Utilisateur',
        phoneNumber: '0687654321',
        address: '456 Avenue des Tests, Rabat',
        isAdmin: 0
      }
    ]);
    
    // 4. Créer des produits de test
    console.log('🏋️‍♂️ Création des produits de test...');
    await db.insert(schema.products).values([
      {
        name: 'Protéine Whey Premium',
        description: 'Protéine de haute qualité pour la récupération musculaire.',
        price: 35000, // 350 MAD en centimes
        imageUrl: 'https://example.com/protein.jpg',
        category: 'supplement',
        subcategory: 'protein',
        stock: 50,
        featured: 1,
        discount: 10
      },
      {
        name: 'Creatine Monohydrate',
        description: 'Supplément pour améliorer la force et les performances.',
        price: 25000, // 250 MAD en centimes
        imageUrl: 'https://example.com/creatine.jpg',
        category: 'supplement',
        subcategory: 'performance',
        stock: 35,
        featured: 1,
        discount: 0
      },
      {
        name: 'Gants d\'entraînement',
        description: 'Gants robustes pour la protection des mains pendant l\'entraînement.',
        price: 15000, // 150 MAD en centimes
        imageUrl: 'https://example.com/gloves.jpg',
        category: 'equipment',
        subcategory: 'accessories',
        stock: 20,
        featured: 0,
        discount: 15
      },
      {
        name: 'Barre de traction',
        description: 'Barre de traction de haute qualité pour exercices à domicile.',
        price: 90000, // 900 MAD en centimes
        imageUrl: 'https://example.com/pullup.jpg',
        category: 'equipment',
        subcategory: 'training',
        stock: 10,
        featured: 1,
        discount: 5
      }
    ]);
    
    // 5. Créer quelques commandes de test
    console.log('🛒 Création des commandes de test...');
    
    // Commande pour l'utilisateur 1
    const order1 = await db.insert(schema.orders).values({
      userId: 2, // ID de l'utilisateur1
      status: 'delivered',
      totalAmount: 60000, // 600 MAD
      customerName: 'Premier Utilisateur',
      customerEmail: 'utilisateur1@exemple.ma',
      customerPhone: '0612345678',
      shippingAddress: '123 Rue des Exemples, Casablanca'
    }).returning();
    
    if (order1 && order1.length > 0) {
      await db.insert(schema.orderItems).values([
        {
          orderId: order1[0].id,
          productId: 1, // Protéine Whey
          quantity: 1,
          priceAtPurchase: 35000
        },
        {
          orderId: order1[0].id,
          productId: 2, // Creatine
          quantity: 1,
          priceAtPurchase: 25000
        }
      ]);
    }
    
    // Commande pour l'utilisateur 2
    const order2 = await db.insert(schema.orders).values({
      userId: 3, // ID de l'utilisateur2
      status: 'pending',
      totalAmount: 90000, // 900 MAD
      customerName: 'Deuxième Utilisateur',
      customerEmail: 'utilisateur2@exemple.ma',
      customerPhone: '0687654321',
      shippingAddress: '456 Avenue des Tests, Rabat'
    }).returning();
    
    if (order2 && order2.length > 0) {
      await db.insert(schema.orderItems).values({
        orderId: order2[0].id,
        productId: 4, // Barre de traction
        quantity: 1,
        priceAtPurchase: 90000
      });
    }
    
    // 6. Ajouter des articles au panier pour les utilisateurs
    console.log('🛍️ Ajout d\'articles aux paniers...');
    
    await db.insert(schema.cartItems).values([
      {
        userId: 2, // utilisateur1
        productId: 3, // Gants
        quantity: 1
      },
      {
        userId: 3, // utilisateur2
        productId: 1, // Protéine
        quantity: 2
      },
      {
        userId: 3, // utilisateur2
        productId: 2, // Creatine
        quantity: 1
      }
    ]);
    
    console.log('🎉 Initialisation des données terminée avec succès !');
    console.log('\n📌 Identifiants de connexion:');
    console.log('Admin: admin / admin123');
    console.log('Utilisateur 1: utilisateur1 / user123');
    console.log('Utilisateur 2: utilisateur2 / user456');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation des données:', error);
  } finally {
    await tursoClient.close();
  }
}

main(); 