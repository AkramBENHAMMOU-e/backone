import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Users Table
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  phoneNumber: text('phone_number'),
  address: text('address'),
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true });

// Products Table
export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(), // in centimes (1/100 MAD)
  imageUrl: text('image_url').notNull(),
  category: text('category').notNull(), // 'supplement' or 'equipment'
  subcategory: text('subcategory').notNull(),
  stock: integer('stock').notNull().default(0),
  featured: integer('featured', { mode: 'boolean' }).default(false),
  discount: integer('discount').default(0), // discount percentage
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const insertProductSchema = createInsertSchema(products)
  .omit({ id: true, createdAt: true });

// Orders Table
export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'), // Optional - user can order without an account
  status: text('status').notNull().default('pending'), // pending, shipped, delivered, cancelled
  totalAmount: integer('total_amount').notNull(), // in centimes (1/100 MAD)
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone').notNull(),
  shippingAddress: text('shipping_address').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const insertOrderSchema = createInsertSchema(orders)
  .omit({ id: true, createdAt: true, updatedAt: true });

// Order Items Table
export const orderItems = sqliteTable('order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: integer('order_id').notNull(),
  productId: integer('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  priceAtPurchase: integer('price_at_purchase').notNull(), // in centimes (1/100 MAD)
});

export const insertOrderItemSchema = createInsertSchema(orderItems)
  .omit({ id: true });

// Session Table pour stocker les sessions
export const sessionTable = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at').notNull(),
  data: text('data').notNull(),
});

// Cart items (used only for Turso storage)
export const cartItems = sqliteTable('cart_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  productId: integer('product_id').notNull(),
  quantity: integer('quantity').notNull().default(1),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Cart Item Schema for validation
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