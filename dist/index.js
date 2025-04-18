var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// index.ts
import dotenv from "dotenv";
import express from "express";

// auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session2 from "express-session";
import { scrypt as scrypt2, randomBytes as randomBytes2, timingSafeEqual as timingSafeEqual2 } from "crypto";
import { promisify as promisify2 } from "util";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  cartItemSchema: () => cartItemSchema,
  insertOrderItemSchema: () => insertOrderItemSchema,
  insertOrderSchema: () => insertOrderSchema,
  insertProductSchema: () => insertProductSchema,
  insertUserSchema: () => insertUserSchema,
  orderItems: () => orderItems,
  orders: () => orders,
  products: () => products,
  statsSchema: () => statsSchema,
  users: () => users
});
import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  phoneNumber: text("phone_number"),
  address: text("address"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
var products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  // in centimes (1/100 MAD)
  imageUrl: text("image_url").notNull(),
  category: text("category").notNull(),
  // 'supplement' or 'equipment'
  subcategory: text("subcategory").notNull(),
  stock: integer("stock").notNull().default(0),
  featured: boolean("featured").default(false),
  discount: integer("discount").default(0),
  // discount percentage
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });
var orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  // Optional now - user can order without an account
  status: text("status").notNull().default("pending"),
  // pending, shipped, delivered, cancelled
  totalAmount: integer("total_amount").notNull(),
  // in centimes (1/100 MAD)
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  shippingAddress: text("shipping_address").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
var orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  priceAtPurchase: integer("price_at_purchase").notNull()
  // in centimes (1/100 MAD)
});
var insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });
var cartItemSchema = z.object({
  productId: z.number(),
  quantity: z.number().min(1)
});
var statsSchema = z.object({
  salesByMonth: z.record(z.string(), z.number()),
  totalSales: z.number(),
  totalOrders: z.number(),
  totalCustomers: z.number(),
  popularProducts: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      sales: z.number()
    })
  )
});

// db.ts
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
neonConfig.fetchConnectionCache = true;
var DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_GkyWtclF76xe@ep-muddy-scene-a2dyqp50-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";
var sql = neon(DATABASE_URL);
var db = drizzle(sql, { schema: schema_exports });
async function testConnection() {
  try {
    const result = await sql`SELECT 1 as connection_test`;
    console.log("Database connection successful", result);
    return true;
  } catch (error) {
    console.error("Database connection error:", error);
    return false;
  }
}

// storage-db.ts
import { eq, desc, sql as sql2 } from "drizzle-orm";
import session from "express-session";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import MemoryStore from "memorystore";
var scryptAsync = promisify(scrypt);
var MemoryStoreSession = MemoryStore(session);
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}
var DatabaseStorage = class {
  // In-memory storage for cart since we don't have a cart table yet
  carts;
  sessionStore;
  constructor() {
    this.carts = {};
    this.sessionStore = new MemoryStoreSession({
      checkPeriod: 864e5
      // 24 heures en millisecondes
    });
    this.getUserByUsername("admin").then((user) => {
      if (!user) {
        this.createUser({
          username: "admin",
          password: "admin123",
          // This will be hashed in auth.ts
          email: "admin@fitmaroc.ma",
          fullName: "Admin",
          isAdmin: true
        });
      }
    });
  }
  // User operations
  async getUser(id) {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }
  async getUserByUsername(username) {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }
  async getUserByEmail(email) {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }
  async createUser(user) {
    let userToInsert = { ...user };
    if (userToInsert.password && !userToInsert.password.includes(".")) {
      userToInsert.password = await hashPassword(userToInsert.password);
    }
    const [result] = await db.insert(users).values(userToInsert).returning();
    return result;
  }
  async getAllUsers() {
    return await db.select().from(users);
  }
  async deleteUser(id) {
    const result = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    return result.length > 0;
  }
  // Product operations
  async createProduct(product) {
    const [result] = await db.insert(products).values(product).returning();
    return result;
  }
  async getProduct(id) {
    const result = await db.select().from(products).where(eq(products.id, id));
    return result[0];
  }
  async getAllProducts() {
    return await db.select().from(products);
  }
  async getProductsByCategory(category) {
    return await db.select().from(products).where(eq(products.category, category));
  }
  async getProductsBySubcategory(subcategory) {
    return await db.select().from(products).where(eq(products.subcategory, subcategory));
  }
  async getFeaturedProducts() {
    return await db.select().from(products).where(eq(products.featured, true));
  }
  async updateProduct(id, product) {
    const result = await db.update(products).set(product).where(eq(products.id, id)).returning();
    return result[0];
  }
  async updateProductStock(id, quantityChange) {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    if (!product) {
      return void 0;
    }
    const newStock = product.stock + quantityChange;
    if (newStock < 0) {
      throw new Error("Insufficient stock");
    }
    const [updatedProduct] = await db.update(products).set({ stock: newStock }).where(eq(products.id, id)).returning();
    return updatedProduct;
  }
  async deleteProduct(id) {
    const result = await db.delete(products).where(eq(products.id, id)).returning({ id: products.id });
    return result.length > 0;
  }
  // Order operations
  async createOrder(insertOrder, items) {
    return await db.transaction(async (tx) => {
      const [order] = await tx.insert(orders).values(insertOrder).returning();
      const orderItemsWithOrderId = items.map((item) => ({
        ...item,
        orderId: order.id
      }));
      await tx.insert(orderItems).values(orderItemsWithOrderId);
      for (const item of items) {
        const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found`);
        }
        const newStock = product.stock - item.quantity;
        if (newStock < 0) {
          throw new Error(`Insufficient stock for product ${product.name}`);
        }
        await tx.update(products).set({ stock: newStock }).where(eq(products.id, item.productId));
      }
      return order;
    });
  }
  async getOrder(id) {
    const orderResult = await db.select().from(orders).where(eq(orders.id, id));
    if (!orderResult.length) {
      return void 0;
    }
    const order = orderResult[0];
    const orderItemsResult = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    return { order, items: orderItemsResult };
  }
  async getOrdersByUser(userId) {
    return await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  }
  async getAllOrders() {
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }
  async updateOrderStatus(id, status) {
    const now = /* @__PURE__ */ new Date();
    const result = await db.update(orders).set({ status, updatedAt: now }).where(eq(orders.id, id)).returning();
    return result[0];
  }
  // Cart operations (using in-memory for simplicity)
  async getCart(userId) {
    if (!this.carts[userId]) {
      this.carts[userId] = /* @__PURE__ */ new Map();
    }
    return this.carts[userId];
  }
  async addToCart(userId, productId, quantity) {
    if (!this.carts[userId]) {
      this.carts[userId] = /* @__PURE__ */ new Map();
    }
    const currentQuantity = this.carts[userId].get(productId) || 0;
    this.carts[userId].set(productId, currentQuantity + quantity);
  }
  async removeFromCart(userId, productId) {
    if (!this.carts[userId]) {
      return;
    }
    this.carts[userId].delete(productId);
  }
  async clearCart(userId) {
    this.carts[userId] = /* @__PURE__ */ new Map();
  }
  // Stats operations
  async getStats() {
    const allOrders = await db.select().from(orders);
    const totalCustomersResult = await db.select({ count: sql2`count(*)` }).from(users).where(eq(users.isAdmin, false));
    const totalCustomers = totalCustomersResult[0].count;
    const salesByMonth = {};
    allOrders.forEach((order) => {
      const month = order.createdAt.toLocaleString("fr-FR", { month: "long", year: "numeric" });
      salesByMonth[month] = (salesByMonth[month] || 0) + order.totalAmount;
    });
    const popularProductsResult = await db.select({
      productId: orderItems.productId,
      totalSales: sql2`sum(${orderItems.quantity})`
    }).from(orderItems).groupBy(orderItems.productId).orderBy(desc(sql2`sum(${orderItems.quantity})`)).limit(5);
    const popularProducts = await Promise.all(
      popularProductsResult.map(async (item) => {
        const [product] = await db.select().from(products).where(eq(products.id, item.productId));
        return {
          id: item.productId,
          name: product?.name || "Produit inconnu",
          sales: Number(item.totalSales)
        };
      })
    );
    const totalSales = allOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    return {
      salesByMonth,
      totalSales,
      totalOrders: allOrders.length,
      totalCustomers,
      popularProducts
    };
  }
};
var storage = new DatabaseStorage();

// auth.ts
var scryptAsync2 = promisify2(scrypt2);
async function hashPassword2(password) {
  const salt = randomBytes2(16).toString("hex");
  const buf = await scryptAsync2(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}
async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync2(supplied, salt, 64);
  return timingSafeEqual2(hashedBuf, suppliedBuf);
}
function setupAuth(app2) {
  const sessionSettings = {
    secret: process.env.SESSION_SECRET || "fitmaroc-secret-key",
    resave: true,
    saveUninitialized: true,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1e3 * 60 * 60 * 24 * 7
      // 1 week
    }
  };
  app2.set("trust proxy", 1);
  app2.use(session2(sessionSettings));
  app2.use(passport.initialize());
  app2.use(passport.session());
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !await comparePasswords(password, user.password)) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    })
  );
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });
  app2.post("/api/register", async (req, res, next) => {
    try {
      const { username, email } = req.body;
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Nom d'utilisateur d\xE9j\xE0 utilis\xE9" });
      }
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email d\xE9j\xE0 utilis\xE9" });
      }
      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword2(req.body.password)
      });
      const { password, ...userWithoutPassword } = user;
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Erreur lors de l'inscription" });
    }
  });
  app2.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: "Nom d'utilisateur ou mot de passe incorrect" });
      }
      req.login(user, (err2) => {
        if (err2) return next(err2);
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      });
    })(req, res, next);
  });
  app2.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });
  app2.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });
}

// routes.ts
import { z as z2 } from "zod";
import { fromZodError } from "zod-validation-error";
import { v2 as cloudinary } from "cloudinary";
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "YOUR_CLOUD_NAME",
  api_key: process.env.CLOUDINARY_API_KEY || "YOUR_API_KEY",
  api_secret: process.env.CLOUDINARY_API_SECRET || "YOUR_API_SECRET",
  secure: true
});
function isAdmin(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Non authentifi\xE9" });
  }
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: "Acc\xE8s non autoris\xE9" });
  }
  next();
}
function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z2.ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(400).json({ message: "Donn\xE9es invalides" });
      }
    }
  };
}
function registerRoutes(app2) {
  setupAuth(app2);
  app2.get("/api/products", async (req, res) => {
    try {
      const products2 = await storage.getAllProducts();
      res.json(products2);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Erreur lors de la r\xE9cup\xE9ration des produits" });
    }
  });
  app2.get("/api/products/featured", async (req, res) => {
    try {
      const products2 = await storage.getFeaturedProducts();
      res.json(products2);
    } catch (error) {
      console.error("Error fetching featured products:", error);
      res.status(500).json({ message: "Erreur lors de la r\xE9cup\xE9ration des produits" });
    }
  });
  app2.get("/api/products/category/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const products2 = await storage.getProductsByCategory(category);
      res.json(products2);
    } catch (error) {
      console.error("Error fetching products by category:", error);
      res.status(500).json({ message: "Erreur lors de la r\xE9cup\xE9ration des produits" });
    }
  });
  app2.get("/api/products/subcategory/:subcategory", async (req, res) => {
    try {
      const { subcategory } = req.params;
      const products2 = await storage.getProductsBySubcategory(subcategory);
      res.json(products2);
    } catch (error) {
      console.error("Error fetching products by subcategory:", error);
      res.status(500).json({ message: "Erreur lors de la r\xE9cup\xE9ration des produits" });
    }
  });
  app2.get("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID produit invalide" });
      }
      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ message: "Produit non trouv\xE9" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Erreur lors de la r\xE9cup\xE9ration du produit" });
    }
  });
  app2.post("/api/products", isAdmin, validateBody(insertProductSchema), async (req, res) => {
    try {
      const product = await storage.createProduct(req.body);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Erreur lors de la cr\xE9ation du produit" });
    }
  });
  app2.patch("/api/products/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID produit invalide" });
      }
      const product = await storage.updateProduct(id, req.body);
      if (!product) {
        return res.status(404).json({ message: "Produit non trouv\xE9" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Erreur lors de la mise \xE0 jour du produit" });
    }
  });
  app2.delete("/api/products/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID produit invalide" });
      }
      const success = await storage.deleteProduct(id);
      if (!success) {
        return res.status(404).json({ message: "Produit non trouv\xE9" });
      }
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Erreur lors de la suppression du produit" });
    }
  });
  const initGuestCart = (req) => {
    if (!req.session.guestCart) {
      req.session.guestCart = {};
    }
    return req.session.guestCart;
  };
  const objectToMap = (obj) => {
    const map = /* @__PURE__ */ new Map();
    for (const [key, value] of Object.entries(obj)) {
      map.set(parseInt(key), value);
    }
    return map;
  };
  const mapToObject = (map) => {
    if (!(map instanceof Map)) {
      return map;
    }
    const obj = {};
    for (const [key, value] of map.entries()) {
      obj[key] = value;
    }
    return obj;
  };
  app2.get("/api/cart", async (req, res) => {
    try {
      if (req.isAuthenticated()) {
        const cart = await storage.getCart(req.user.id);
        const cartItems = [];
        for (const [productId, quantity] of cart.entries()) {
          const product = await storage.getProduct(productId);
          if (product) {
            cartItems.push({
              product,
              quantity
            });
          }
        }
        res.json(cartItems);
      } else {
        const guestCartObj = initGuestCart(req);
        const cartItems = [];
        for (const [productIdStr, quantity] of Object.entries(guestCartObj)) {
          const productId = parseInt(productIdStr);
          const product = await storage.getProduct(productId);
          if (product) {
            cartItems.push({
              product,
              quantity
            });
          }
        }
        res.json(cartItems);
      }
    } catch (error) {
      console.error("Error fetching cart:", error);
      res.status(500).json({ message: "Erreur lors de la r\xE9cup\xE9ration du panier" });
    }
  });
  app2.post("/api/cart", validateBody(cartItemSchema), async (req, res) => {
    try {
      const { productId, quantity } = req.body;
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Produit non trouv\xE9" });
      }
      if (product.stock < quantity) {
        return res.status(400).json({ message: "Stock insuffisant" });
      }
      if (req.isAuthenticated()) {
        await storage.addToCart(req.user.id, productId, quantity);
        const cart = await storage.getCart(req.user.id);
        const cartItems = [];
        for (const [productId2, quantity2] of cart.entries()) {
          const product2 = await storage.getProduct(productId2);
          if (product2) {
            cartItems.push({
              product: product2,
              quantity: quantity2
            });
          }
        }
        res.status(200).json(cartItems);
      } else {
        const guestCart = initGuestCart(req);
        const currentQty = guestCart[productId] || 0;
        guestCart[productId] = currentQty + quantity;
        req.session.guestCart = guestCart;
        const cartItems = [];
        for (const [productIdStr, quantity2] of Object.entries(guestCart)) {
          const pId = parseInt(productIdStr);
          const product2 = await storage.getProduct(pId);
          if (product2) {
            cartItems.push({
              product: product2,
              quantity: quantity2
            });
          }
        }
        res.status(200).json(cartItems);
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
      res.status(500).json({ message: "Erreur lors de l'ajout au panier" });
    }
  });
  app2.delete("/api/cart/:productId", async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      if (isNaN(productId)) {
        return res.status(400).json({ message: "ID produit invalide" });
      }
      if (req.isAuthenticated()) {
        await storage.removeFromCart(req.user.id, productId);
        const cart = await storage.getCart(req.user.id);
        const cartItems = [];
        for (const [productId2, quantity] of cart.entries()) {
          const product = await storage.getProduct(productId2);
          if (product) {
            cartItems.push({
              product,
              quantity
            });
          }
        }
        res.status(200).json(cartItems);
      } else {
        const guestCart = initGuestCart(req);
        delete guestCart[productId];
        req.session.guestCart = guestCart;
        const cartItems = [];
        for (const [productIdStr, quantity] of Object.entries(guestCart)) {
          const pId = parseInt(productIdStr);
          const product = await storage.getProduct(pId);
          if (product) {
            cartItems.push({
              product,
              quantity
            });
          }
        }
        res.status(200).json(cartItems);
      }
    } catch (error) {
      console.error("Error removing from cart:", error);
      res.status(500).json({ message: "Erreur lors du retrait du panier" });
    }
  });
  app2.delete("/api/cart", async (req, res) => {
    try {
      if (req.isAuthenticated()) {
        await storage.clearCart(req.user.id);
      } else {
        req.session.guestCart = {};
      }
      res.sendStatus(204);
    } catch (error) {
      console.error("Error clearing cart:", error);
      res.status(500).json({ message: "Erreur lors de la suppression du panier" });
    }
  });
  app2.post("/api/orders", async (req, res) => {
    try {
      const {
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        userId
      } = req.body;
      if (!customerName || !customerEmail || !customerPhone || !shippingAddress) {
        return res.status(400).json({
          message: "Informations client incompl\xE8tes. Veuillez fournir nom, email, t\xE9l\xE9phone et adresse."
        });
      }
      const isAuthenticated = req.isAuthenticated();
      const currentUserId = isAuthenticated ? req.user.id : userId || null;
      let totalAmount = 0;
      const orderItems2 = [];
      if (isAuthenticated) {
        const cart = await storage.getCart(req.user.id);
        if (cart.size === 0) {
          return res.status(400).json({ message: "Le panier est vide" });
        }
        for (const [productId, quantity] of cart.entries()) {
          const product = await storage.getProduct(productId);
          if (!product) {
            return res.status(400).json({ message: `Produit avec ID ${productId} non trouv\xE9` });
          }
          if (product.stock < quantity) {
            return res.status(400).json({ message: `Stock insuffisant pour ${product.name}` });
          }
          const discountedPrice = product.discount && product.discount > 0 ? Math.round(product.price * (1 - product.discount / 100)) : product.price;
          totalAmount += discountedPrice * quantity;
          orderItems2.push({
            productId,
            quantity,
            priceAtPurchase: discountedPrice
          });
        }
      } else {
        const guestCart = req.session.guestCart || {};
        if (Object.keys(guestCart).length === 0) {
          return res.status(400).json({ message: "Le panier est vide" });
        }
        for (const [productIdStr, qty] of Object.entries(guestCart)) {
          const productId = parseInt(productIdStr);
          const quantity = typeof qty === "number" ? qty : parseInt(String(qty));
          const product = await storage.getProduct(productId);
          if (!product) {
            return res.status(400).json({ message: `Produit avec ID ${productId} non trouv\xE9` });
          }
          if (product.stock < quantity) {
            return res.status(400).json({ message: `Stock insuffisant pour ${product.name}` });
          }
          const discountedPrice = product.discount && product.discount > 0 ? Math.round(product.price * (1 - product.discount / 100)) : product.price;
          totalAmount += discountedPrice * quantity;
          orderItems2.push({
            productId,
            quantity,
            priceAtPurchase: discountedPrice
          });
        }
      }
      const order = await storage.createOrder(
        {
          userId: currentUserId,
          status: "pending",
          totalAmount,
          customerName,
          customerEmail,
          customerPhone,
          shippingAddress
        },
        orderItems2
      );
      if (isAuthenticated) {
        await storage.clearCart(req.user.id);
      } else {
        req.session.guestCart = {};
      }
      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Erreur lors de la cr\xE9ation de la commande" });
    }
  });
  app2.get("/api/orders", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Non authentifi\xE9" });
    }
    try {
      const orders2 = await storage.getOrdersByUser(req.user.id);
      res.json(orders2);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Erreur lors de la r\xE9cup\xE9ration des commandes" });
    }
  });
  app2.get("/api/orders/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Non authentifi\xE9" });
    }
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID commande invalide" });
      }
      const orderData = await storage.getOrder(id);
      if (!orderData) {
        return res.status(404).json({ message: "Commande non trouv\xE9e" });
      }
      if (orderData.order.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Acc\xE8s non autoris\xE9" });
      }
      res.json(orderData);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Erreur lors de la r\xE9cup\xE9ration de la commande" });
    }
  });
  app2.get("/api/admin/orders", isAdmin, async (req, res) => {
    try {
      const orders2 = await storage.getAllOrders();
      res.json(orders2);
    } catch (error) {
      console.error("Error fetching all orders:", error);
      res.status(500).json({ message: "Erreur lors de la r\xE9cup\xE9ration des commandes" });
    }
  });
  app2.patch("/api/admin/orders/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID commande invalide" });
      }
      const { status } = req.body;
      if (!status || !["pending", "shipped", "delivered", "cancelled"].includes(status)) {
        return res.status(400).json({ message: "Statut invalide" });
      }
      const order = await storage.updateOrderStatus(id, status);
      if (!order) {
        return res.status(404).json({ message: "Commande non trouv\xE9e" });
      }
      res.json(order);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Erreur lors de la mise \xE0 jour du statut de la commande" });
    }
  });
  app2.get("/api/admin/customers", isAdmin, async (req, res) => {
    try {
      const users2 = await storage.getAllUsers();
      const customers = users2.filter((user) => !user.isAdmin).map(({ password, ...user }) => user);
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Erreur lors de la r\xE9cup\xE9ration des clients" });
    }
  });
  app2.delete("/api/admin/customers/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID client invalide" });
      }
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "Client non trouv\xE9" });
      }
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ message: "Erreur lors de la suppression du client" });
    }
  });
  app2.get("/api/admin/stats", isAdmin, async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Erreur lors de la r\xE9cup\xE9ration des statistiques" });
    }
  });
  app2.get("/api/cloudinary/signature", (req, res) => {
    try {
      const timestamp2 = Math.round((/* @__PURE__ */ new Date()).getTime() / 1e3);
      const signature = cloudinary.utils.api_sign_request(
        {
          timestamp: timestamp2,
          folder: "sportmaroc",
          // Dossier où les images seront stockées
          upload_preset: "sportmaroc_uploads"
          // Preset configured in Cloudinary
        },
        process.env.CLOUDINARY_API_SECRET || "YOUR_API_SECRET"
      );
      res.json({
        signature,
        timestamp: timestamp2,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY
      });
    } catch (error) {
      console.error("Erreur de signature Cloudinary:", error);
      res.status(500).json({ message: "Erreur lors de la g\xE9n\xE9ration de la signature" });
    }
  });
}

// vite.ts
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  log("Development mode with Vite middleware is disabled in this version");
  log("Frontend will be served from a separate server");
  app2.use("*", (req, res, next) => {
    if (req.originalUrl.startsWith("/api")) {
      next();
      return;
    }
    res.status(200).send(`
      <html>
        <head>
          <title>SportMarocShop API</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
            h1 { color: #e00; }
            code { background: #f0f0f0; padding: 0.2rem 0.4rem; border-radius: 3px; }
          </style>
        </head>
        <body>
          <h1>SportMarocShop API Server</h1>
          <p>Le serveur API est en cours d'ex\xE9cution.</p>
          <p>Endpoints API accessibles \xE0 <code>/api/*</code></p>
        </body>
      </html>
    `);
  });
}
function serveStatic(app2) {
  app2.get("/", (req, res) => {
    res.status(200).send(`
      <html>
        <head>
          <title>SportMarocShop API</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
            h1 { color: #e00; }
            code { background: #f0f0f0; padding: 0.2rem 0.4rem; border-radius: 3px; }
          </style>
        </head>
        <body>
          <h1>SportMarocShop API Server</h1>
          <p>Le serveur API est en cours d'ex\xE9cution.</p>
          <p>Endpoints API accessibles \xE0 <code>/api/*</code></p>
        </body>
      </html>
    `);
  });
  app2.use("*", (req, res, next) => {
    if (req.originalUrl.startsWith("/api")) {
      next();
      return;
    }
    res.status(404).send(`
      <html>
        <head>
          <title>404 - Page non trouv\xE9e</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
            h1 { color: #e00; }
          </style>
        </head>
        <body>
          <h1>404 - Page non trouv\xE9e</h1>
          <p>L'URL demand\xE9e n'existe pas sur ce serveur.</p>
          <p>Ce serveur h\xE9berge uniquement l'API SportMarocShop.</p>
        </body>
      </html>
    `);
  });
}

// index.ts
import cors from "cors";
import session3 from "express-session";
import MemoryStore2 from "memorystore";
dotenv.config();
var MemoryStoreSession2 = MemoryStore2(session3);
var app = express();
app.use(cors({
  origin: process.env.NODE_ENV === "production" ? ["https://sportmarocshop.vercel.app", "https://sportmarocshop-git-main-yourusername.vercel.app"] : "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));
app.use(session3({
  secret: process.env.SESSION_SECRET || "sportmarocshop-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1e3
    // 24 heures
  },
  store: new MemoryStoreSession2({
    checkPeriod: 864e5
    // 24 heures en millisecondes
  })
}));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false, limit: "5mb" }));
app.use((req, res, next) => {
  try {
    const start = Date.now();
    const path = req.path;
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        const logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        console.log(logLine);
      }
    });
    next();
  } catch (error) {
    next(error);
  }
});
app.get("/api/health", async (req, res) => {
  try {
    const dbConnected = await testConnection();
    res.status(200).json({
      status: "OK",
      environment: process.env.NODE_ENV,
      database: dbConnected ? "connected" : "disconnected"
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: "Health check failed"
    });
  }
});
registerRoutes(app);
app.use((err, _req, res, _next) => {
  console.error("Error caught by global error handler:", err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});
if (process.env.NODE_ENV === "development") {
  const server = app.listen(5e3, () => {
    console.log(`Server started on port 5000`);
    testConnection().then((connected) => {
      console.log(`Database connection test: ${connected ? "successful" : "failed"}`);
    }).catch((err) => {
      console.error("Database connection test error:", err);
    });
  });
  setupVite(app, server);
} else {
  serveStatic(app);
}
var index_default = app;
export {
  index_default as default
};
