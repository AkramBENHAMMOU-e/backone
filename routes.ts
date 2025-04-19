import type { Express, Request, Response } from "express";
import { setupAuth } from "./auth.js";
import { storage } from "./storage-turso.js"; // Utiliser le nouveau stockage avec Turso
import { insertProductSchema, insertOrderSchema, insertOrderItemSchema, cartItemSchema } from "./db/schema.js";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { v2 as cloudinary } from 'cloudinary';
import { comparePasswords, hashPassword } from "./auth.js"; // Importer directement les fonctions d'authentification

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
  function initGuestCart(req: Request) {
    // Si l'utilisateur n'est pas connecté, utiliser un panier invité stocké dans la session
    if (!req.isAuthenticated() && !(req.session as any).guestCart) {
      (req.session as any).guestCart = {};
    }
    return (req.session as any).guestCart || {};
  }
  
  // Convertir l'objet du panier en Map pour utilisation dans l'API
  function objectToMap(obj: Record<string, number>) {
    // Obj = { productId: quantity, productId: quantity, ... }
    const map = new Map<number, number>();
    if (!obj) return map;
    
    for (const [productId, quantity] of Object.entries(obj)) {
      map.set(parseInt(productId), quantity);
    }
    return map;
  }
  
  // Convertir la Map en objet pour le stockage dans la session
  function mapToObject(map: Map<number, number>) {
    // Map = productId -> quantity
    const obj: Record<number, number> = {};
    if (!map) return obj;
    
    for (const [productId, quantity] of map.entries()) {
      obj[productId] = quantity;
    }
    return obj;
  }
  
  // Get cart (works for both authenticated and unauthenticated users)
  app.get("/api/cart", async (req: Request, res: Response) => {
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
  app.post("/api/cart", validateBody(cartItemSchema), async (req: Request, res: Response) => {
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
        (req.session as any).guestCart = guestCart;
        
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
  app.delete("/api/cart/:productId", async (req: Request, res: Response) => {
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
        (req.session as any).guestCart = guestCart;
        
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
  app.delete("/api/cart", async (req: Request, res: Response) => {
    try {
      if (req.isAuthenticated()) {
        // Utilisateur connecté - utiliser le stockage persistant
        await storage.clearCart(req.user.id);
      } else {
        // Utilisateur non connecté - utiliser le panier de session
        (req.session as any).guestCart = {}; // Objet vide, pas de Map
      }
      res.sendStatus(204);
    } catch (error) {
      console.error("Error clearing cart:", error);
      res.status(500).json({ message: "Erreur lors de la suppression du panier" });
    }
  });
  
  // ORDER ROUTES
  
  // Create order
  app.post("/api/orders", async (req: Request, res: Response) => {
    try {
      console.log("Création de commande - Début");
      console.log("Body reçu:", JSON.stringify(req.body));
      
      const { 
        customerName, 
        customerEmail, 
        customerPhone, 
        shippingAddress, 
        userId,
        cartItems: providedCartItems,
        totalAmount: providedTotalAmount
      } = req.body;
      
      // Vérifier les informations obligatoires
      if (!customerName || !customerEmail || !customerPhone || !shippingAddress) {
        console.log("Informations client incomplètes:", { customerName, customerEmail, customerPhone, shippingAddress });
        return res.status(400).json({ 
          message: "Informations client incomplètes. Veuillez fournir nom, email, téléphone et adresse." 
        });
      }
      
      // Identifier l'utilisateur (connecté ou invité)
      const isAuthenticated = req.isAuthenticated();
      console.log("Utilisateur authentifié:", isAuthenticated);
      console.log("User dans la session:", req.user);
      
      const currentUserId = isAuthenticated ? req.user.id : (userId || null);
      console.log("ID utilisateur pour la commande:", currentUserId);
      
      let totalAmount = providedTotalAmount || 0;
      let orderItems = [];
      
      // Si les données du panier sont fournies, les utiliser directement
      if (providedCartItems && Array.isArray(providedCartItems) && providedCartItems.length > 0) {
        console.log("Utilisation des données de panier fournies:", providedCartItems);
        orderItems = providedCartItems;
        
        // Si le montant total n'est pas fourni, le calculer
        if (!providedTotalAmount) {
          totalAmount = orderItems.reduce((total, item) => total + (item.priceAtPurchase * item.quantity), 0);
        }
      } else {
        // Sinon, utiliser la méthode habituelle
        console.log("Aucune donnée de panier fournie, recherche du panier...");
      
      // Différent traitement selon le type d'authentification
      if (isAuthenticated) {
          console.log("Traitement panier utilisateur authentifié");
        // Pour les utilisateurs connectés, obtenir le panier depuis la base de données
        const cart = await storage.getCart(req.user.id);
          console.log("Panier récupéré:", Array.from(cart.entries()));
        
        if (cart.size === 0) {
            console.log("Panier vide pour l'utilisateur:", req.user.id);
          return res.status(400).json({ message: "Le panier est vide" });
        }
        
        // Parcourir les produits du panier
        for (const [productId, quantity] of cart.entries()) {
            console.log(`Traitement produit #${productId}, quantité:`, quantity);
          const product = await storage.getProduct(productId);
          if (!product) {
              console.log(`Produit non trouvé: #${productId}`);
            return res.status(400).json({ message: `Produit avec ID ${productId} non trouvé` });
          }
          
          if (product.stock < quantity) {
              console.log(`Stock insuffisant pour ${product.name}: disponible=${product.stock}, demandé=${quantity}`);
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
          console.log("Traitement panier invité");
        // Pour les utilisateurs non connectés, obtenir le panier depuis la session
        const guestCart = req.session.guestCart || {};
          console.log("Panier invité:", guestCart);
        
        if (Object.keys(guestCart).length === 0) {
            console.log("Panier invité vide");
          return res.status(400).json({ message: "Le panier est vide" });
        }
        
        // Parcourir les produits du panier invité
        for (const [productIdStr, qty] of Object.entries(guestCart)) {
          const productId = parseInt(productIdStr);
          // Conversion explicite en nombre
          const quantity = typeof qty === 'number' ? qty : parseInt(String(qty));
            console.log(`Traitement produit #${productId}, quantité:`, quantity);
          
          const product = await storage.getProduct(productId);
          if (!product) {
              console.log(`Produit non trouvé: #${productId}`);
            return res.status(400).json({ message: `Produit avec ID ${productId} non trouvé` });
          }
          
          if (product.stock < quantity) {
              console.log(`Stock insuffisant pour ${product.name}: disponible=${product.stock}, demandé=${quantity}`);
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
      }
      
      // Vérifier que des articles sont présents
      if (orderItems.length === 0) {
        console.log("Aucun article dans la commande");
        return res.status(400).json({ message: "Le panier est vide" });
      }
      
      console.log("Résumé de la commande:");
      console.log("- Articles:", orderItems);
      console.log("- Montant total:", totalAmount);
      
      // Créer la commande
      console.log("Création de la commande dans la base de données...");
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
      
      console.log("Commande créée avec succès:", order);
      
      // Vider le panier selon le type d'utilisateur
      if (isAuthenticated) {
        console.log("Nettoyage du panier utilisateur:", req.user.id);
        await storage.clearCart(req.user.id);
      } else {
        console.log("Nettoyage du panier invité");
        (req.session as any).guestCart = {};
      }
      
      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message);
        console.error("Error stack:", error.stack);
      }
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

  // =========================
  // ADMIN PROFILE UPDATE (admin only)
  // =========================
  app.put("/api/admin/profile", isAdmin, async (req: Request, res: Response) => {
    try {
      console.log("=== Mise à jour du profil admin ===");
      console.log("Body reçu:", JSON.stringify(req.body));
      
      const { email, username, password, confirmPassword, currentPassword } = req.body;
      console.log("Données extraites:", { email, username, password: password ? "******" : undefined, confirmPassword: confirmPassword ? "******" : undefined, currentPassword: currentPassword ? "******" : undefined });
      
      // Vérification côté backend : mot de passe et confirmation doivent correspondre
      if (password && password !== confirmPassword) {
        console.log("Erreur: Les mots de passe ne correspondent pas");
        return res.status(400).json({ message: "Les mots de passe ne correspondent pas." });
      }
      
      // On ne modifie QUE l'utilisateur connecté (admin)
      const adminId = req.user.id;
      console.log("ID admin:", adminId);
      
      const admin = await storage.getUser(adminId);
      console.log("Admin trouvé:", admin ? `Oui (username: ${admin.username})` : "Non");
      
      if (!admin || !admin.isAdmin) {
        console.log("Erreur: Utilisateur non admin");
        return res.status(403).json({ message: "Accès non autorisé" });
      }

      // Vérifier si l'email change et s'il est déjà pris
      if (email && email !== admin.email) {
        console.log(`Vérification de l'email: ${email}`);
        const existingEmail = await storage.getUserByEmail(email);
        console.log("Email existant:", existingEmail ? `Oui (id: ${existingEmail.id})` : "Non");
        
        if (existingEmail && existingEmail.id !== adminId) {
          console.log("Erreur: Email déjà utilisé");
          return res.status(400).json({ message: "Cet email est déjà utilisé." });
        }
      }

      // Vérifier si le nom d'utilisateur change et s'il est déjà pris
      if (username && username !== admin.username) {
        console.log(`Vérification du username: ${username}`);
        const existingUsername = await storage.getUserByUsername(username);
        console.log("Username existant:", existingUsername ? `Oui (id: ${existingUsername.id})` : "Non");
        
        if (existingUsername && existingUsername.id !== adminId) {
          console.log("Erreur: Username déjà utilisé");
          return res.status(400).json({ message: "Ce nom d'utilisateur est déjà utilisé." });
        }
      }

      // Préparer les mises à jour
      const update: any = {};
      if (email && email !== admin.email) update.email = email;
      if (username && username !== admin.username) update.username = username;
      console.log("Mises à jour prévues (sans mot de passe):", update);

      // Si le mot de passe doit être changé, vérifier l'ancien mot de passe
      if (password && password.length > 0) {
        console.log("Mise à jour du mot de passe demandée");
        
        if (!currentPassword) {
          console.log("Erreur: Mot de passe actuel non fourni");
          return res.status(400).json({ message: "Le mot de passe actuel est requis." });
        }
        
        // Vérifier que currentPassword correspond au mot de passe actuel de l'admin
        console.log("Vérification du mot de passe actuel...");
        try {
          const valid = await comparePasswords(currentPassword, admin.password);
          console.log("Mot de passe actuel valide:", valid);
          
          if (!valid) {
            console.log("Erreur: Mot de passe actuel incorrect");
            return res.status(400).json({ message: "Le mot de passe actuel est incorrect." });
          }
          
          // Hash le nouveau mot de passe uniquement si l'ancien est validé
          console.log("Hachage du nouveau mot de passe...");
          update.password = await hashPassword(password);
          console.log("Nouveau mot de passe haché avec succès");
        } catch (passwordError) {
          console.error("Erreur lors de la vérification/hachage du mot de passe:", passwordError);
          return res.status(500).json({ message: "Erreur lors du traitement du mot de passe." });
        }
      }

      // Vérifier s'il y a des modifications
      if (Object.keys(update).length === 0) {
        console.log("Aucune modification à enregistrer");
        return res.status(400).json({ message: "Aucune modification à enregistrer." });
      }
      
      // Appliquer la mise à jour
      console.log("Application des mises à jour:", Object.keys(update));
      try {
        const updated = await storage.updateUser(adminId, update);
        console.log("Résultat de la mise à jour:", updated ? "Succès" : "Échec");
        
        if (!updated) {
          console.log("Erreur: Échec de la mise à jour");
          return res.status(500).json({ message: "Erreur lors de la mise à jour." });
        }
        
        // Ne jamais renvoyer le mot de passe
        const { password: _, ...adminSafe } = updated;
        console.log("Réponse envoyée avec succès");
        res.json(adminSafe);
      } catch (updateError) {
        console.error("Erreur lors de la mise à jour de l'utilisateur:", updateError);
        return res.status(500).json({ message: "Erreur lors de la mise à jour de l'utilisateur." });
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour du profil admin:", error);
      if (error instanceof Error) {
        console.error("Message d'erreur:", error.message);
        console.error("Stack trace:", error.stack);
      }
      res.status(500).json({ message: "Erreur serveur" });
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
