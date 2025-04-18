import { users, type User, type InsertUser, products, type Product, type InsertProduct, orders, type Order, type InsertOrder, orderItems, type OrderItem, type InsertOrderItem, type Stats } from "@shared/schema";
import { db, pool } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// Fonction pour hacher un mot de passe
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// PostgreSQL session store
const PostgresSessionStore = connectPg(session);

// Cart storage type 
type CartStorage = {
  [userId: number]: Map<number, number>; // productId -> quantity
};

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
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
  createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
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

export class DatabaseStorage implements IStorage {
  // In-memory storage for cart since we don't have a cart table yet
  private carts: CartStorage;
  sessionStore: session.Store;
  
  constructor() {
    this.carts = {};
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
    
    // Check if admin user exists, if not create it
    this.getUserByUsername("admin").then(user => {
      if (!user) {
        this.createUser({
          username: "admin",
          password: "admin123", // This will be hashed in auth.ts
          email: "admin@fitmaroc.ma",
          fullName: "Admin",
          isAdmin: true,
        });
      }
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return result[0];
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    // Hash the password if it's not already hashed
    let userToInsert = { ...user };
    if (userToInsert.password && !userToInsert.password.includes('.')) {
      userToInsert.password = await hashPassword(userToInsert.password);
    }
    
    const [result] = await db
      .insert(users)
      .values(userToInsert)
      .returning();
    return result;
  }
  
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  
  async deleteUser(id: number): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return result.length > 0;
  }

  // Product operations
  async createProduct(product: InsertProduct): Promise<Product> {
    const [result] = await db
      .insert(products)
      .values(product)
      .returning();
    return result;
  }
  
  async getProduct(id: number): Promise<Product | undefined> {
    const result = await db
      .select()
      .from(products)
      .where(eq(products.id, id));
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
      .where(eq(products.featured, true));
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
    // First get the current stock
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id));
    
    if (!product) {
      return undefined;
    }
    
    const newStock = product.stock + quantityChange;
    if (newStock < 0) {
      throw new Error("Insufficient stock");
    }
    
    // Update with new stock
    const [updatedProduct] = await db
      .update(products)
      .set({ stock: newStock })
      .where(eq(products.id, id))
      .returning();
      
    return updatedProduct;
  }
  
  async deleteProduct(id: number): Promise<boolean> {
    const result = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning({ id: products.id });
    return result.length > 0;
  }

  // Order operations
  async createOrder(insertOrder: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    // Start a transaction
    return await db.transaction(async (tx) => {
      // Create the order
      const [order] = await tx
        .insert(orders)
        .values(insertOrder)
        .returning();
      
      // Create the order items with the order ID
      const orderItemsWithOrderId = items.map(item => ({
        ...item,
        orderId: order.id
      }));
      
      await tx
        .insert(orderItems)
        .values(orderItemsWithOrderId);
      
      // Update product stocks
      for (const item of items) {
        const [product] = await tx
          .select()
          .from(products)
          .where(eq(products.id, item.productId));
        
        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found`);
        }
        
        const newStock = product.stock - item.quantity;
        if (newStock < 0) {
          throw new Error(`Insufficient stock for product ${product.name}`);
        }
        
        await tx
          .update(products)
          .set({ stock: newStock })
          .where(eq(products.id, item.productId));
      }
      
      return order;
    });
  }
  
  async getOrder(id: number): Promise<{ order: Order; items: OrderItem[] } | undefined> {
    const orderResult = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id));
      
    if (!orderResult.length) {
      return undefined;
    }
    
    const order = orderResult[0];
    
    const orderItemsResult = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, id));
      
    return { order, items: orderItemsResult };
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
    const now = new Date();
    const result = await db
      .update(orders)
      .set({ status, updatedAt: now })
      .where(eq(orders.id, id))
      .returning();
      
    return result[0];
  }

  // Cart operations (using in-memory for simplicity)
  async getCart(userId: number): Promise<Map<number, number>> {
    if (!this.carts[userId]) {
      this.carts[userId] = new Map();
    }
    return this.carts[userId];
  }
  
  async addToCart(userId: number, productId: number, quantity: number): Promise<void> {
    if (!this.carts[userId]) {
      this.carts[userId] = new Map();
    }
    
    const currentQuantity = this.carts[userId].get(productId) || 0;
    this.carts[userId].set(productId, currentQuantity + quantity);
  }
  
  async removeFromCart(userId: number, productId: number): Promise<void> {
    if (!this.carts[userId]) {
      return;
    }
    
    this.carts[userId].delete(productId);
  }
  
  async clearCart(userId: number): Promise<void> {
    this.carts[userId] = new Map();
  }
  
  // Stats operations
  async getStats(): Promise<Stats> {
    // Get all orders
    const allOrders = await db.select().from(orders);
    
    // Get user count
    const totalCustomersResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.isAdmin, false));
    const totalCustomers = totalCustomersResult[0].count;
    
    // Calculate sales by month
    const salesByMonth: Record<string, number> = {};
    allOrders.forEach(order => {
      const month = order.createdAt.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
      salesByMonth[month] = (salesByMonth[month] || 0) + order.totalAmount;
    });
    
    // Get popular products
    const popularProductsResult = await db
      .select({
        productId: orderItems.productId,
        totalSales: sql<number>`sum(${orderItems.quantity})`,
      })
      .from(orderItems)
      .groupBy(orderItems.productId)
      .orderBy(desc(sql`sum(${orderItems.quantity})`))
      .limit(5);
    
    // Get product details for popular products
    const popularProducts = await Promise.all(
      popularProductsResult.map(async (item) => {
        const [product] = await db
          .select()
          .from(products)
          .where(eq(products.id, item.productId));
        
        return {
          id: item.productId,
          name: product?.name || "Produit inconnu",
          sales: Number(item.totalSales),
        };
      })
    );
    
    // Calculate total sales
    const totalSales = allOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    
    return {
      salesByMonth,
      totalSales,
      totalOrders: allOrders.length,
      totalCustomers,
      popularProducts,
    };
  }
}

// Create and export an instance of the storage
export const storage = new DatabaseStorage();