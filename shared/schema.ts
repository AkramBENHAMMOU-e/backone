import { pgTable, text, serial, integer, boolean, jsonb, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users Table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  phoneNumber: text("phone_number"),
  address: text("address"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true });

// Products Table
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(), // in centimes (1/100 MAD)
  imageUrl: text("image_url").notNull(),
  category: text("category").notNull(), // 'supplement' or 'equipment'
  subcategory: text("subcategory").notNull(),
  stock: integer("stock").notNull().default(0),
  featured: boolean("featured").default(false),
  discount: integer("discount").default(0), // discount percentage
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(products)
  .omit({ id: true, createdAt: true });

// Orders Table
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"), // Optional now - user can order without an account
  status: text("status").notNull().default("pending"), // pending, shipped, delivered, cancelled
  totalAmount: integer("total_amount").notNull(), // in centimes (1/100 MAD)
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  shippingAddress: text("shipping_address").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(orders)
  .omit({ id: true, createdAt: true, updatedAt: true });

// Order Items Table
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  priceAtPurchase: integer("price_at_purchase").notNull(), // in centimes (1/100 MAD)
});

export const insertOrderItemSchema = createInsertSchema(orderItems)
  .omit({ id: true });

// Cart items (used only for in-memory storage)
export const cartItemSchema = z.object({
  productId: z.number(),
  quantity: z.number().min(1),
});

// Stats (for admin dashboard)
export const statsSchema = z.object({
  salesByMonth: z.record(z.string(), z.number()),
  totalSales: z.number(),
  totalOrders: z.number(),
  totalCustomers: z.number(),
  popularProducts: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      sales: z.number(),
    })
  ),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

export type CartItem = z.infer<typeof cartItemSchema>;
export type CartContent = CartItem[];

export type Stats = z.infer<typeof statsSchema>;
