import { users, type User, type InsertUser, products, type Product, type InsertProduct, orders, type Order, type InsertOrder, orderItems, type OrderItem, type InsertOrderItem, type Stats } from "@shared/schema";
import { randomUUID } from "crypto";
import createMemoryStore from "memorystore";
import session from "express-session";

// Memory store for sessions
const MemoryStore = createMemoryStore(session);

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
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private products: Map<number, Product>;
  private orders: Map<number, Order>;
  private orderItems: Map<number, OrderItem[]>;
  private carts: CartStorage;
  private sessionStore: session.SessionStore;
  private currentUserId: number;
  private currentProductId: number;
  private currentOrderId: number;
  private currentOrderItemId: number;

  constructor() {
    this.users = new Map();
    this.products = new Map();
    this.orders = new Map();
    this.orderItems = new Map();
    this.carts = {};
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // Clear expired sessions every 24h
    });
    this.currentUserId = 1;
    this.currentProductId = 1;
    this.currentOrderId = 1;
    this.currentOrderItemId = 1;
    
    // Create admin user by default
    this.createUser({
      username: "admin",
      password: "admin123", // This will be hashed in auth.ts
      email: "admin@fitmaroc.ma",
      fullName: "Admin",
      isAdmin: true,
    });
    
    // Seed products
    this.seedProducts();
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    );
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const now = new Date();
    const user: User = { ...insertUser, id, createdAt: now };
    this.users.set(id, user);
    return user;
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  // Product operations
  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = this.currentProductId++;
    const now = new Date();
    const product: Product = { ...insertProduct, id, createdAt: now };
    this.products.set(id, product);
    return product;
  }
  
  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }
  
  async getAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }
  
  async getProductsByCategory(category: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      (product) => product.category === category,
    );
  }
  
  async getProductsBySubcategory(subcategory: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      (product) => product.subcategory === subcategory,
    );
  }
  
  async getFeaturedProducts(): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      (product) => product.featured,
    );
  }
  
  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const existingProduct = this.products.get(id);
    if (!existingProduct) {
      return undefined;
    }
    
    const updatedProduct = { ...existingProduct, ...product };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }
  
  async updateProductStock(id: number, quantityChange: number): Promise<Product | undefined> {
    const existingProduct = this.products.get(id);
    if (!existingProduct) {
      return undefined;
    }
    
    const updatedStock = existingProduct.stock + quantityChange;
    if (updatedStock < 0) {
      throw new Error("Insufficient stock");
    }
    
    const updatedProduct = { ...existingProduct, stock: updatedStock };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }
  
  async deleteProduct(id: number): Promise<boolean> {
    return this.products.delete(id);
  }

  // Order operations
  async createOrder(insertOrder: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    const id = this.currentOrderId++;
    const now = new Date();
    const order: Order = { 
      ...insertOrder, 
      id, 
      createdAt: now,
      updatedAt: now
    };
    
    this.orders.set(id, order);
    
    // Create order items
    const orderItems: OrderItem[] = items.map(item => {
      const itemId = this.currentOrderItemId++;
      return { ...item, id, orderId: order.id };
    });
    
    this.orderItems.set(id, orderItems);
    
    // Update product stocks
    for (const item of items) {
      await this.updateProductStock(item.productId, -item.quantity);
    }
    
    return order;
  }
  
  async getOrder(id: number): Promise<{ order: Order; items: OrderItem[] } | undefined> {
    const order = this.orders.get(id);
    if (!order) {
      return undefined;
    }
    
    const items = this.orderItems.get(id) || [];
    return { order, items };
  }
  
  async getOrdersByUser(userId: number): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(
      (order) => order.userId === userId,
    );
  }
  
  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }
  
  async updateOrderStatus(id: number, status: string): Promise<Order | undefined> {
    const existingOrder = this.orders.get(id);
    if (!existingOrder) {
      return undefined;
    }
    
    const now = new Date();
    const updatedOrder = { 
      ...existingOrder, 
      status, 
      updatedAt: now 
    };
    
    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }

  // Cart operations
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
    const orders = Array.from(this.orders.values());
    const users = Array.from(this.users.values());
    
    // Sales by month
    const salesByMonth: Record<string, number> = {};
    orders.forEach(order => {
      const month = order.createdAt.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
      salesByMonth[month] = (salesByMonth[month] || 0) + order.totalAmount;
    });
    
    // Popular products
    const productSales: Record<number, number> = {};
    for (const orderId of this.orderItems.keys()) {
      const items = this.orderItems.get(orderId) || [];
      items.forEach(item => {
        productSales[item.productId] = (productSales[item.productId] || 0) + item.quantity;
      });
    }
    
    const popularProducts = Object.entries(productSales)
      .map(([productId, sales]) => {
        const product = this.products.get(Number(productId));
        return {
          id: Number(productId),
          name: product?.name || "Produit inconnu",
          sales,
        };
      })
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);
    
    return {
      salesByMonth,
      totalSales: orders.reduce((sum, order) => sum + order.totalAmount, 0),
      totalOrders: orders.length,
      totalCustomers: users.filter(user => !user.isAdmin).length,
      popularProducts,
    };
  }
  
  // Private methods for seeding data
  private seedProducts() {
    // Supplements
    this.createProduct({
      name: "Protéine Whey Premium",
      description: "Supplément riche en protéines pour la récupération musculaire. Contribue à la croissance et au maintien de la masse musculaire.",
      price: 34900, // 349 MAD
      imageUrl: "https://images.unsplash.com/photo-1594498653385-d5172c532c00?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=400&q=80",
      category: "supplement",
      subcategory: "proteine",
      stock: 50,
      featured: true,
      discount: 0,
    });
    
    this.createProduct({
      name: "Vitamines Multi-Complex",
      description: "Complément multivitaminé pour le bien-être quotidien. Formule complète pour soutenir votre santé et votre vitalité.",
      price: 19900, // 199 MAD
      imageUrl: "https://images.unsplash.com/photo-1581009137042-c552e485697a?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=400&q=80",
      category: "supplement",
      subcategory: "vitamine",
      stock: 30,
      featured: true,
      discount: 15,
    });
    
    this.createProduct({
      name: "Créatine Monohydrate",
      description: "Améliore les performances sportives et favorise la récupération. Idéal pour les athlètes cherchant à optimiser leurs entraînements.",
      price: 25900, // 259 MAD
      imageUrl: "https://images.unsplash.com/photo-1579722861954-cfd5453ae50e?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=400&q=80",
      category: "supplement",
      subcategory: "performance",
      stock: 25,
      featured: false,
      discount: 0,
    });
    
    this.createProduct({
      name: "Brûleur de Graisse Avancé",
      description: "Formule thermogénique pour favoriser la perte de poids et augmenter le métabolisme. Parfait pour accompagner un régime et un entraînement régulier.",
      price: 29900, // 299 MAD
      imageUrl: "https://images.unsplash.com/photo-1586806658634-c0dbf0e25744?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=400&q=80",
      category: "supplement",
      subcategory: "bruleur",
      stock: 20,
      featured: false,
      discount: 10,
    });
    
    this.createProduct({
      name: "BCAA Complex 2:1:1",
      description: "Acides aminés pour favoriser la récupération et limiter le catabolisme musculaire. Idéal pendant l'entraînement.",
      price: 22900, // 229 MAD
      imageUrl: "https://images.unsplash.com/photo-1567962266573-a891e01280fe?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=400&q=80",
      category: "supplement",
      subcategory: "acides-amines",
      stock: 35,
      featured: false,
      discount: 0,
    });
    
    this.createProduct({
      name: "Pré-Workout Extreme",
      description: "Boostez votre énergie et votre concentration avant l'entraînement. Formule puissante pour des performances maximales.",
      price: 27900, // 279 MAD
      imageUrl: "https://images.unsplash.com/photo-1615354650192-c6e7d9d4e95c?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=400&q=80",
      category: "supplement",
      subcategory: "performance",
      stock: 15,
      featured: true,
      discount: 0,
    });
    
    // Equipment
    this.createProduct({
      name: "Haltères 5kg (Paire)",
      description: "Haltères en fonte avec revêtement antidérapant. Parfaits pour les exercices de force et de musculation à domicile.",
      price: 22000, // 220 MAD
      imageUrl: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=400&q=80",
      category: "equipment",
      subcategory: "musculation",
      stock: 10,
      featured: true,
      discount: 0,
    });
    
    this.createProduct({
      name: "Bandes élastiques (Set de 3)",
      description: "Bandes de résistance pour l'entraînement complet du corps. Idéales pour la rééducation, le fitness et le renforcement musculaire.",
      price: 12000, // 120 MAD
      imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=400&q=80",
      category: "equipment",
      subcategory: "accessoires",
      stock: 25,
      featured: true,
      discount: 0,
    });
    
    this.createProduct({
      name: "Tapis de Yoga Premium",
      description: "Tapis antidérapant et écologique pour le yoga et le fitness. Confortable et durable pour toutes vos séances.",
      price: 18000, // 180 MAD
      imageUrl: "https://images.unsplash.com/photo-1603988363607-e1e4a66962c6?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=400&q=80",
      category: "equipment",
      subcategory: "accessoires",
      stock: 15,
      featured: false,
      discount: 5,
    });
    
    this.createProduct({
      name: "Kettlebell 10kg",
      description: "Kettlebell en fonte pour des exercices dynamiques et polyvalents. Parfait pour le cardio et le renforcement musculaire.",
      price: 25000, // 250 MAD
      imageUrl: "https://images.unsplash.com/photo-1616763355548-1b606f439f86?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=400&q=80",
      category: "equipment",
      subcategory: "musculation",
      stock: 8,
      featured: false,
      discount: 0,
    });
    
    this.createProduct({
      name: "Corde à Sauter Pro",
      description: "Corde à sauter ajustable avec poignées ergonomiques. Idéale pour le cardio et la coordination.",
      price: 8000, // 80 MAD
      imageUrl: "https://images.unsplash.com/photo-1601422407532-55a3394fd5df?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=400&q=80",
      category: "equipment",
      subcategory: "accessoires",
      stock: 30,
      featured: false,
      discount: 0,
    });
    
    this.createProduct({
      name: "Banc de Musculation Pliable",
      description: "Banc robuste et polyvalent pour vos exercices de musculation. Pliable pour un rangement facile.",
      price: 120000, // 1200 MAD
      imageUrl: "https://images.unsplash.com/photo-1517344884509-a0c97ec11bcc?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=400&q=80",
      category: "equipment",
      subcategory: "musculation",
      stock: 5,
      featured: true,
      discount: 10,
    });
  }
}

export const storage = new MemStorage();
