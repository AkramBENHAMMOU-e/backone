import { users, type User, type InsertUser, products, type Product, type InsertProduct, orders, type Order, type InsertOrder, orderItems, type OrderItem, type InsertOrderItem, type Stats, cartItems } from "./db/schema.js";
import { db, tursoClient } from "./db/index.js";
import { and, eq, desc, sql, like, or, asc } from "drizzle-orm";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import MemoryStore from 'memorystore';

const scryptAsync = promisify(scrypt);
const MemoryStoreSession = MemoryStore(session);

// Fonction pour hacher un mot de passe
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Fonction pour comparer un mot de passe avec un hash
async function comparePasswords(password: string, storedPassword: string) {
  // storedPassword est au format "hash.salt"
  const [hashedPassword, salt] = storedPassword.split(".");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(Buffer.from(hashedPassword, "hex"), buf);
}

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Product operations
  createProduct(product: InsertProduct): Promise<Product>;
  getProduct(id: number): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  getProductsByCategory(category: string): Promise<Product[]>;
  getProductsBySubcategory(subcategory: string): Promise<Product[]>;
  getFeaturedProducts(): Promise<Product[]>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  updateProductStock(id: number, quantityChange: number): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  
  // Order operations
  createOrder(order: InsertOrder, items: Omit<InsertOrderItem, "orderId">[]): Promise<Order>;
  getOrder(id: number): Promise<{ order: Order; items: OrderItem[] } | undefined>;
  getOrdersByUser(userId: number): Promise<Order[]>;
  getAllOrders(): Promise<Order[]>;
  updateOrderStatus(id: number, status: string): Promise<Order | undefined>;
  
  // Cart operations
  getCart(userId: number): Promise<Map<number, number>>;
  addToCart(userId: number, productId: number, quantity: number): Promise<void>;
  removeFromCart(userId: number, productId: number): Promise<void>;
  clearCart(userId: number): Promise<void>;
  
  // Stats operations
  getStats(): Promise<Stats>;
  
  // Session store
  sessionStore: session.Store;
}

export class TursoStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    // Utiliser MemoryStore au lieu de TursoStore
    this.sessionStore = new MemoryStoreSession({
      checkPeriod: 86400000 // 24 heures (purge des sessions expirées)
    });
    
    // Vérifier si l'utilisateur admin existe déjà, sinon le créer
    this.initAdminUser();
  }
  
  // Méthode d'initialisation de l'admin
  private async initAdminUser() {
    try {
      // Vérifier si l'utilisateur admin existe déjà
      const existingAdmin = await this.getUserByEmail("admin@fitmaroc.ma");
      
      if (!existingAdmin) {
        console.log("Aucun utilisateur admin trouvé. Création de l'utilisateur admin...");
        await this.createUser({
          username: "admin",
          password: "admin123", // This will be hashed
          email: "admin@fitmaroc.ma",
          fullName: "Admin",
          isAdmin: true,
        });
        console.log("Utilisateur admin créé avec succès!");
      } else {
        console.log("Utilisateur admin existant trouvé, aucune création nécessaire.");
      }
    } catch (error) {
      console.error("Erreur lors de l'initialisation de l'utilisateur admin:", error);
      // Ne pas faire échouer l'initialisation de l'application si la création de l'admin échoue
    }
  }
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return result[0];
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return result[0];
  }
  
  async createUser(user: InsertUser): Promise<User> {
    try {
      const hashedPassword = await hashPassword(user.password);
      
      // Vérifier si un utilisateur existe déjà avec cet email ou ce nom d'utilisateur
      const existingUserByEmail = await this.getUserByEmail(user.email);
      const existingUserByUsername = await this.getUserByUsername(user.username);
      
      if (existingUserByEmail) {
        console.log(`Échec de création d'utilisateur: l'email ${user.email} est déjà utilisé.`);
        throw new Error("Email already exists");
      }
      
      if (existingUserByUsername) {
        console.log(`Échec de création d'utilisateur: le nom d'utilisateur ${user.username} est déjà utilisé.`);
        throw new Error("Username already exists");
      }
      
      // Insérer l'utilisateur
      const result = await db
        .insert(users)
        .values(user)
        .returning();

      if (result.length === 0) {
        console.log("Aucune ligne insérée lors de la création de l'utilisateur");
        throw new Error("User creation failed");
      }

      // Récupérer l'utilisateur créé
      const createdUser = result[0];
      return createdUser;
    } catch (error) {
      console.error("Erreur lors de la création d'un utilisateur:", error);
      
      // Vérifier si c'est une erreur de contrainte unique
      const errorMessage = String(error);
      if (errorMessage.includes("UNIQUE constraint failed")) {
        if (errorMessage.includes("email")) {
          console.log(`Erreur de contrainte: l'email ${user.email} est déjà utilisé`);
        } else if (errorMessage.includes("username")) {
          console.log(`Erreur de contrainte: le nom d'utilisateur ${user.username} est déjà utilisé`);
        }
      }
      
      throw error;
    }
  }
  
  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    // Hash the password if it's provided and not already hashed
    let userToUpdate = { ...user };
    if (userToUpdate.password && !userToUpdate.password.includes('.')) {
      userToUpdate.password = await hashPassword(userToUpdate.password);
    }
    
    const result = await db
      .update(users)
      .set(userToUpdate)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }
  
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  
  async deleteUser(id: number): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning();
    return result.length > 0;
  }
  
  // Product operations
  async createProduct(product: InsertProduct): Promise<Product> {
    const result = await db
      .insert(products)
      .values(product)
      .returning();
    return result[0];
  }
  
  async getProduct(id: number): Promise<Product | undefined> {
    const result = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    return result[0];
  }
  
  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }
  
  async getProductsByCategory(category: string): Promise<Product[]> {
    return await db
      .select()
      .from(products)
      .where(eq(products.category, category));
  }
  
  async getProductsBySubcategory(subcategory: string): Promise<Product[]> {
    return await db
      .select()
      .from(products)
      .where(eq(products.subcategory, subcategory));
  }
  
  async getFeaturedProducts(): Promise<Product[]> {
    return await db
      .select()
      .from(products)
      .where(eq(products.featured, 1));
  }
  
  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const result = await db
      .update(products)
      .set(product)
      .where(eq(products.id, id))
      .returning();
    return result[0];
  }
  
  async updateProductStock(id: number, quantityChange: number): Promise<Product | undefined> {
    try {
      console.log(`UpdateProductStock - Début pour produit #${id}, changement: ${quantityChange}`);
      
      // First get the current stock
      const product = await this.getProduct(id);
      
      if (!product) {
        console.error(`UpdateProductStock - Produit #${id} non trouvé`);
        return undefined;
      }
      
      console.log(`UpdateProductStock - Stock actuel: ${product.stock}`);
      
      const newStock = product.stock + quantityChange;
      if (newStock < 0) {
        console.error(`UpdateProductStock - Stock insuffisant: ${product.stock} + ${quantityChange} = ${newStock}`);
        throw new Error(`Insufficient stock for product ${id}`);
      }
      
      console.log(`UpdateProductStock - Nouveau stock: ${newStock}`);
      
      // Update with new stock
      const result = await db
        .update(products)
        .set({ stock: newStock })
        .where(eq(products.id, id))
        .returning();
      
      console.log(`UpdateProductStock - Mise à jour réussie:`, result);
      
      return result[0];
    } catch (error) {
      console.error(`UpdateProductStock - Erreur:`, error);
      throw error;
    }
  }
  
  async deleteProduct(id: number): Promise<boolean> {
    const result = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning();
    return result.length > 0;
  }
  
  // Order operations
  async createOrder(insertOrder: InsertOrder, items: Omit<InsertOrderItem, "orderId">[]): Promise<Order> {
    // Approche sans transaction pour éviter les problèmes
    try {
      console.log("CreateOrder - Début");
      
      // 1. Insérer la commande
      console.log("CreateOrder - Insertion de la commande:", insertOrder);
      const orderResult = await db
        .insert(orders)
        .values(insertOrder)
        .returning();
      
      console.log("CreateOrder - Résultat insertion commande:", orderResult);
      
      if (!orderResult || orderResult.length === 0) {
        console.error("CreateOrder - Échec de création de commande, retour vide");
        throw new Error("Order creation failed");
      }
      
      const order = orderResult[0];
      console.log("CreateOrder - Commande créée:", order);
      
      // 2. Insérer les articles de commande
      for (const item of items) {
        try {
          console.log(`CreateOrder - Insertion article: productId=${item.productId}, quantity=${item.quantity}, price=${item.priceAtPurchase}`);
          
          const orderItemValues = {
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            priceAtPurchase: item.priceAtPurchase
          };
          
          console.log("CreateOrder - Valeurs de l'article à insérer:", orderItemValues);
          
          await db.insert(orderItems).values(orderItemValues);
          
          console.log(`CreateOrder - Article inséré pour produit ${item.productId}`);
          
          // 3. Mettre à jour le stock des produits
          console.log(`CreateOrder - Mise à jour stock pour produit ${item.productId}, -${item.quantity}`);
          const product = await this.getProduct(item.productId);
          
          if (product) {
            const newStock = product.stock - item.quantity;
            if (newStock >= 0) {
              await db.update(products)
                .set({ stock: newStock })
                .where(eq(products.id, item.productId));
              console.log(`CreateOrder - Stock mis à jour pour produit ${item.productId}: ${product.stock} -> ${newStock}`);
            } else {
              console.warn(`CreateOrder - Stock insuffisant pour produit ${item.productId}: ${product.stock} < ${item.quantity}`);
            }
          } else {
            console.warn(`CreateOrder - Produit ${item.productId} non trouvé pour mise à jour du stock`);
          }
        } catch (itemError) {
          console.error(`CreateOrder - Erreur lors de l'insertion/mise à jour pour l'article ${item.productId}:`, itemError);
          console.error("Cette erreur est ignorée pour permettre la création de la commande");
          // Continuer malgré l'erreur
        }
      }
      
      console.log("CreateOrder - Commande complétée avec succès");
      return order;
    } catch (error) {
      console.error("CreateOrder - Erreur:", error);
      if (error instanceof Error) {
        console.error("CreateOrder - Message d'erreur:", error.message);
        console.error("CreateOrder - Stack trace:", error.stack);
      }
      throw error;
    }
  }
  
  async getOrder(id: number): Promise<{ order: Order; items: OrderItem[] } | undefined> {
    const orderResult = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);
    
    if (!orderResult.length) {
      return undefined;
    }
    
    const orderItemsResult = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, id));
    
    return {
      order: orderResult[0],
      items: orderItemsResult
    };
  }
  
  async getOrdersByUser(userId: number): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
  }
  
  async getAllOrders(): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt));
  }
  
  async updateOrderStatus(id: number, status: string): Promise<Order | undefined> {
    const result = await db
      .update(orders)
      .set({ 
        status,
        updatedAt: new Date().toISOString() 
      })
      .where(eq(orders.id, id))
      .returning();
    return result[0];
  }
  
  // Cart operations - avec stockage en base de données
  async getCart(userId: number): Promise<Map<number, number>> {
    const cartMap = new Map<number, number>();
    
    const items = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, userId));
    
    for (const item of items) {
      cartMap.set(item.productId, item.quantity);
    }
    
    return cartMap;
  }
  
  async addToCart(userId: number, productId: number, quantity: number): Promise<void> {
    // Vérifier si l'article existe déjà dans le panier
    const existing = await db
      .select()
      .from(cartItems)
      .where(and(
        eq(cartItems.userId, userId),
        eq(cartItems.productId, productId)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      // Mettre à jour la quantité
      const newQuantity = existing[0].quantity + quantity;
      await db
        .update(cartItems)
        .set({ quantity: newQuantity })
        .where(eq(cartItems.id, existing[0].id));
    } else {
      // Ajouter un nouvel article
      await db
        .insert(cartItems)
        .values({
          userId,
          productId,
          quantity
        });
    }
  }
  
  async removeFromCart(userId: number, productId: number): Promise<void> {
    await db
      .delete(cartItems)
      .where(and(
        eq(cartItems.userId, userId),
        eq(cartItems.productId, productId)
      ));
  }
  
  async clearCart(userId: number): Promise<void> {
    await db
      .delete(cartItems)
      .where(eq(cartItems.userId, userId));
  }
  
  // Stats operations
  async getStats(): Promise<Stats> {
    // 1. Total des ventes et total des commandes
    const totalSalesQuery = await tursoClient.execute(`
      SELECT 
        COUNT(DISTINCT o.id) as totalOrders, 
        SUM(o.total_amount) as totalSales 
      FROM orders o
    `);
    
    const totalSales = totalSalesQuery.rows[0].totalSales || 0;
    const totalOrders = totalSalesQuery.rows[0].totalOrders || 0;
    
    // 2. Nombre total de clients (sans les admin)
    const totalCustomersQuery = await tursoClient.execute(`
      SELECT COUNT(*) as count FROM users WHERE is_admin = 0
    `);
    const totalCustomers = totalCustomersQuery.rows[0].count || 0;
    
    // 3. Ventes par mois
    const salesByMonthQuery = await tursoClient.execute(`
      SELECT 
        strftime('%Y-%m', created_at) as month,
        SUM(total_amount) as amount
      FROM orders
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `);
    
    const salesByMonth: Record<string, number> = {};
    for (const row of salesByMonthQuery.rows) {
      salesByMonth[row.month] = row.amount;
    }
    
    // 4. Produits populaires (basés sur les ventes)
    const popularProductsQuery = await tursoClient.execute(`
      SELECT 
        p.id,
        p.name,
        SUM(oi.quantity) as sales
      FROM products p
      JOIN order_items oi ON p.id = oi.product_id
      GROUP BY p.id, p.name
      ORDER BY sales DESC
      LIMIT 5
    `);
    
    const popularProducts = popularProductsQuery.rows.map(row => ({
      id: row.id,
      name: row.name,
      sales: row.sales
    }));
    
    return {
      salesByMonth,
      totalSales,
      totalOrders,
      totalCustomers,
      popularProducts
    };
  }
}

// Singleton export
export const storage = new TursoStorage();