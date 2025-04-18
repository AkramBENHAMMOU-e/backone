import type { Express, Request, Response } from "express";
import { setupAuth } from "./auth";
import { storage } from "./storage-db"; // Utiliser la base de données au lieu du stockage en mémoire
import { insertProductSchema, insertOrderSchema, insertOrderItemSchema, cartItemSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { v2 as cloudinary } from 'cloudinary';

// Configurer Cloudinary - ajoutez ceci après les imports
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'YOUR_CLOUD_NAME',
  api_key: process.env.CLOUDINARY_API_KEY || 'YOUR_API_KEY',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'YOUR_API_SECRET',
  secure: true,
});

// Helper to check if user is admin
function isAdmin(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Non authentifié" });
  }
  
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: "Accès non autorisé" });
  }
  
  next();
}

// Helper for input validation
function validateBody(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: Function) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(400).json({ message: "Données invalides" });
      }
    }
  };
}

export function registerRoutes(app: Express): void {
  // Set up authentication
  setupAuth(app);
  
  // PRODUCT ROUTES
  
  // Get all products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des produits" });
    }
  });
  
  // Get featured products
  app.get("/api/products/featured", async (req, res) => {
    try {
      const products = await storage.getFeaturedProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching featured products:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des produits" });
    }
  });
  
  // Get products by category
  app.get("/api/products/category/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const products = await storage.getProductsByCategory(category);
      res.json(products);
    } catch (error) {
      console.error("Error fetching products by category:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des produits" });
    }
  });
  
  // Get products by subcategory
  app.get("/api/products/subcategory/:subcategory", async (req, res) => {
    try {
      const { subcategory } = req.params;
      const products = await storage.getProductsBySubcategory(subcategory);
      res.json(products);
    } catch (error) {
      console.error("Error fetching products by subcategory:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des produits" });
    }
  });
  
  // Get product by ID
  app.get("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID produit invalide" });
      }
      
      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ message: "Produit non trouvé" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Erreur lors de la récupération du produit" });
    }
  });
  
  // Create product (admin only)
  app.post("/api/products", isAdmin, validateBody(insertProductSchema), async (req, res) => {
    try {
      const product = await storage.createProduct(req.body);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Erreur lors de la création du produit" });
    }
  });
  
  // Update product (admin only)
  app.patch("/api/products/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID produit invalide" });
      }
      
      const product = await storage.updateProduct(id, req.body);
      if (!product) {
        return res.status(404).json({ message: "Produit non trouvé" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Erreur lors de la mise à jour du produit" });
    }
  });
  
  // Delete product (admin only)
  app.delete("/api/products/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID produit invalide" });
      }
      
      const success = await storage.deleteProduct(id);
      if (!success) {
        return res.status(404).json({ message: "Produit non trouvé" });
      }
      
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Erreur lors de la suppression du produit" });
    }
  });
  
  // CART ROUTES
  
  // Initialiser le panier dans la session pour les utilisateurs non connectés
  const initGuestCart = (req) => {
    if (!req.session.guestCart) {
      // Stocker le panier comme un objet JS standard (pas de Map) dans la session
      req.session.guestCart = {};
    }
    return req.session.guestCart;
  };
  
  // Convertir l'objet du panier en Map pour utilisation dans l'API
  const objectToMap = (obj) => {
    // Créer une nouvelle Map à partir de l'objet
    const map = new Map();
    for (const [key, value] of Object.entries(obj)) {
      // Convertir les clés en nombres (car les productId sont des nombres)
      map.set(parseInt(key), value);
    }
    return map;
  };
  
  // Convertir la Map en objet pour le stockage dans la session
  const mapToObject = (map) => {
    if (!(map instanceof Map)) {
      return map; // Si ce n'est pas une Map, on retourne l'objet tel quel
    }
    
    const obj = {};
    for (const [key, value] of map.entries()) {
      obj[key] = value;
    }
    return obj;
  };
  
  // Get cart (works for both authenticated and unauthenticated users)
  app.get("/api/cart", async (req, res) => {
    try {
      if (req.isAuthenticated()) {
        // Utilisateur connecté - récupérer le panier depuis le stockage
        const cart = await storage.getCart(req.user.id);
        
        // Convertir la Map en tableau d'items avec les détails produits
        const cartItems = [];
        for (const [productId, quantity] of cart.entries()) {
          const product = await storage.getProduct(productId);
          if (product) {
            cartItems.push({
              product,
              quantity,
            });
          }
        }
        
        res.json(cartItems);
      } else {
        // Utilisateur non connecté - récupérer le panier depuis la session
        const guestCartObj = initGuestCart(req);
        const cartItems = [];
        
        // Convertir l'objet panier en tableau d'items avec les détails produits
        for (const [productIdStr, quantity] of Object.entries(guestCartObj)) {
          const productId = parseInt(productIdStr);
          const product = await storage.getProduct(productId);
          if (product) {
            cartItems.push({
              product,
              quantity,
            });
          }
        }
        
        res.json(cartItems);
      }
    } catch (error) {
      console.error("Error fetching cart:", error);
      res.status(500).json({ message: "Erreur lors de la récupération du panier" });
    }
  });
  
  // Add item to cart
  app.post("/api/cart", validateBody(cartItemSchema), async (req, res) => {
    try {
      const { productId, quantity } = req.body;
      
      // Check if product exists and has enough stock
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Produit non trouvé" });
      }
      
      if (product.stock < quantity) {
        return res.status(400).json({ message: "Stock insuffisant" });
      }
      
      // Différent comportement selon l'authentification
      if (req.isAuthenticated()) {
        // Utilisateur connecté - utiliser le stockage persistant
        await storage.addToCart(req.user.id, productId, quantity);
        
        // Récupérer le panier mis à jour
        const cart = await storage.getCart(req.user.id);
        
        // Convertir la Map en tableau d'items avec les détails produits
        const cartItems = [];
        for (const [productId, quantity] of cart.entries()) {
          const product = await storage.getProduct(productId);
          if (product) {
            cartItems.push({
              product,
              quantity,
            });
          }
        }
        
        res.status(200).json(cartItems);
      } else {
        // Utilisateur non connecté - utiliser le panier de session
        const guestCart = initGuestCart(req);
        const currentQty = guestCart[productId] || 0;
        guestCart[productId] = currentQty + quantity;
        
        // Sauvegarder le panier dans la session
        req.session.guestCart = guestCart;
        
        // Préparer la réponse avec les détails du produit
        const cartItems = [];
        for (const [productIdStr, quantity] of Object.entries(guestCart)) {
          const pId = parseInt(productIdStr);
          const product = await storage.getProduct(pId);
          if (product) {
            cartItems.push({
              product,
              quantity,
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
  
  // Remove item from cart
  app.delete("/api/cart/:productId", async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      if (isNaN(productId)) {
        return res.status(400).json({ message: "ID produit invalide" });
      }
      
      // Différent comportement selon l'authentification
      if (req.isAuthenticated()) {
        // Utilisateur connecté - utiliser le stockage persistant
        await storage.removeFromCart(req.user.id, productId);
        
        // Récupérer le panier mis à jour
        const cart = await storage.getCart(req.user.id);
        
        // Convertir la Map en tableau d'items avec les détails produits
        const cartItems = [];
        for (const [productId, quantity] of cart.entries()) {
          const product = await storage.getProduct(productId);
          if (product) {
            cartItems.push({
              product,
              quantity,
            });
          }
        }
        
        res.status(200).json(cartItems);
      } else {
        // Utilisateur non connecté - utiliser le panier de session
        const guestCart = initGuestCart(req);
        delete guestCart[productId]; // Supprimer la propriété
        req.session.guestCart = guestCart;
        
        // Préparer la réponse avec les détails du produit
        const cartItems = [];
        for (const [productIdStr, quantity] of Object.entries(guestCart)) {
          const pId = parseInt(productIdStr);
          const product = await storage.getProduct(pId);
          if (product) {
            cartItems.push({
              product,
              quantity,
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
  
  // Clear cart
  app.delete("/api/cart", async (req, res) => {
    try {
      if (req.isAuthenticated()) {
        // Utilisateur connecté - utiliser le stockage persistant
        await storage.clearCart(req.user.id);
      } else {
        // Utilisateur non connecté - utiliser le panier de session
        req.session.guestCart = {}; // Objet vide, pas de Map
      }
      res.sendStatus(204);
    } catch (error) {
      console.error("Error clearing cart:", error);
      res.status(500).json({ message: "Erreur lors de la suppression du panier" });
    }
  });
  
  // ORDER ROUTES
  
  // Create order
  app.post("/api/orders", async (req, res) => {
    try {
      const { 
        customerName, 
        customerEmail, 
        customerPhone, 
        shippingAddress, 
        userId 
      } = req.body;
      
      // Vérifier les informations obligatoires
      if (!customerName || !customerEmail || !customerPhone || !shippingAddress) {
        return res.status(400).json({ 
          message: "Informations client incomplètes. Veuillez fournir nom, email, téléphone et adresse." 
        });
      }
      
      // Identifier l'utilisateur (connecté ou invité)
      const isAuthenticated = req.isAuthenticated();
      const currentUserId = isAuthenticated ? req.user.id : (userId || null);
      
      let totalAmount = 0;
      const orderItems = [];
      
      // Différent traitement selon le type d'authentification
      if (isAuthenticated) {
        // Pour les utilisateurs connectés, obtenir le panier depuis la base de données
        const cart = await storage.getCart(req.user.id);
        
        if (cart.size === 0) {
          return res.status(400).json({ message: "Le panier est vide" });
        }
        
        // Parcourir les produits du panier
        for (const [productId, quantity] of cart.entries()) {
          const product = await storage.getProduct(productId);
          if (!product) {
            return res.status(400).json({ message: `Produit avec ID ${productId} non trouvé` });
          }
          
          if (product.stock < quantity) {
            return res.status(400).json({ message: `Stock insuffisant pour ${product.name}` });
          }
          
          // Calculer le prix avec remise si applicable
          const discountedPrice = product.discount && product.discount > 0 
            ? Math.round(product.price * (1 - product.discount / 100)) 
            : product.price;
          
          totalAmount += discountedPrice * quantity;
          
          orderItems.push({
            productId,
            quantity,
            priceAtPurchase: discountedPrice,
          });
        }
      } else {
        // Pour les utilisateurs non connectés, obtenir le panier depuis la session
        const guestCart = req.session.guestCart || {};
        
        if (Object.keys(guestCart).length === 0) {
          return res.status(400).json({ message: "Le panier est vide" });
        }
        
        // Parcourir les produits du panier invité
        for (const [productIdStr, qty] of Object.entries(guestCart)) {
          const productId = parseInt(productIdStr);
          // Conversion explicite en nombre
          const quantity = typeof qty === 'number' ? qty : parseInt(String(qty));
          
          const product = await storage.getProduct(productId);
          if (!product) {
            return res.status(400).json({ message: `Produit avec ID ${productId} non trouvé` });
          }
          
          if (product.stock < quantity) {
            return res.status(400).json({ message: `Stock insuffisant pour ${product.name}` });
          }
          
          // Calculer le prix avec remise si applicable
          const discountedPrice = product.discount && product.discount > 0 
            ? Math.round(product.price * (1 - product.discount / 100)) 
            : product.price;
          
          totalAmount += discountedPrice * quantity;
          
          orderItems.push({
            productId,
            quantity,
            priceAtPurchase: discountedPrice,
          });
        }
      }
      
      // Créer la commande
      const order = await storage.createOrder(
        {
          userId: currentUserId,
          status: "pending",
          totalAmount,
          customerName,
          customerEmail,
          customerPhone,
          shippingAddress,
        },
        orderItems
      );
      
      // Vider le panier selon le type d'utilisateur
      if (isAuthenticated) {
        await storage.clearCart(req.user.id);
      } else {
        req.session.guestCart = {};
      }
      
      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Erreur lors de la création de la commande" });
    }
  });
  
  // Get user's orders
  app.get("/api/orders", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    
    try {
      const orders = await storage.getOrdersByUser(req.user.id);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des commandes" });
    }
  });
  
  // Get specific order with items
  app.get("/api/orders/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID commande invalide" });
      }
      
      const orderData = await storage.getOrder(id);
      if (!orderData) {
        return res.status(404).json({ message: "Commande non trouvée" });
      }
      
      // Check if the order belongs to the user or if user is admin
      if (orderData.order.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }
      
      res.json(orderData);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Erreur lors de la récupération de la commande" });
    }
  });
  
  // ADMIN ROUTES
  
  // Get all orders (admin only)
  app.get("/api/admin/orders", isAdmin, async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      console.error("Error fetching all orders:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des commandes" });
    }
  });
  
  // Update order status (admin only)
  app.patch("/api/admin/orders/:id", isAdmin, async (req, res) => {
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
        return res.status(404).json({ message: "Commande non trouvée" });
      }
      
      res.json(order);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Erreur lors de la mise à jour du statut de la commande" });
    }
  });
  
  // Get all customers (admin only)
  app.get("/api/admin/customers", isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Filter out password and admin users
      const customers = users
        .filter(user => !user.isAdmin)
        .map(({ password, ...user }) => user);
      
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des clients" });
    }
  });
  
  // Delete customer (admin only)
  app.delete("/api/admin/customers/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID client invalide" });
      }
      
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "Client non trouvé" });
      }
      
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ message: "Erreur lors de la suppression du client" });
    }
  });
  
  // Get statistics (admin only)
  app.get("/api/admin/stats", isAdmin, async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des statistiques" });
    }
  });

  // Générer une signature Cloudinary pour upload sécurisé
  app.get("/api/cloudinary/signature", (req, res) => {
    try {
      const timestamp = Math.round(new Date().getTime() / 1000);
      const signature = cloudinary.utils.api_sign_request(
        {
          timestamp: timestamp,
          folder: "sportmaroc", // Dossier où les images seront stockées
          upload_preset: "sportmaroc_uploads", // Preset configured in Cloudinary
        },
        process.env.CLOUDINARY_API_SECRET || 'YOUR_API_SECRET'
      );

      res.json({
        signature,
        timestamp,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
      });
    } catch (error) {
      console.error("Erreur de signature Cloudinary:", error);
      res.status(500).json({ message: "Erreur lors de la génération de la signature" });
    }
  });
}
