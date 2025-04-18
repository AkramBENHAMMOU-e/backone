import express from 'express';
import cors from 'cors';

// Création de l'application Express
const app = express();

// Middleware CORS
app.use(cors({
  origin: ['http://localhost:3000', 'https://sportmarocshop.vercel.app'], // Origines spécifiques au lieu de '*'
  credentials: true, // Autoriser l'envoi de cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware pour parser le JSON
app.use(express.json());

// Route de test simple
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from SportMarocShop API!' });
});

// Route produits (données en dur pour le test)
app.get('/api/products', (req, res) => {
  const products = [
    {
      id: 1,
      name: "Protéine Whey Premium",
      description: "Supplément riche en protéines pour la récupération musculaire",
      price: 34900,
      imageUrl: "https://images.unsplash.com/photo-1594498653385-d5172c532c00?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=400&q=80",
      category: "supplement",
      subcategory: "proteine",
      stock: 50,
      featured: true,
      discount: 0
    },
    {
      id: 2,
      name: "Vitamines Multi-Complex",
      description: "Complément multivitaminé pour le bien-être quotidien",
      price: 19900,
      imageUrl: "https://images.unsplash.com/photo-1581009137042-c552e485697a?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=400&q=80",
      category: "supplement",
      subcategory: "vitamine",
      stock: 30,
      featured: true,
      discount: 15
    }
  ];
  
  res.json(products);
});

// Route produits mis en avant
app.get('/api/products/featured', (req, res) => {
  const featuredProducts = [
    {
      id: 1,
      name: "Protéine Whey Premium",
      description: "Supplément riche en protéines pour la récupération musculaire",
      price: 34900,
      imageUrl: "https://images.unsplash.com/photo-1594498653385-d5172c532c00?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=400&q=80",
      category: "supplement",
      subcategory: "proteine",
      stock: 50,
      featured: true,
      discount: 0
    }
  ];
  
  res.json(featuredProducts);
});

// Route panier (vide pour le test)
app.get('/api/cart', (req, res) => {
  res.json([]);
});

// Route utilisateur (non authentifié)
app.get('/api/user', (req, res) => {
  res.status(401).json({ message: "Non authentifié" });
});

// Route pour la page d'accueil / test
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>SportMarocShop API</title>
        <style>
          body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
          h1 { color: #e00; }
          pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>SportMarocShop API</h1>
        <p>L'API fonctionne correctement. Endpoints disponibles :</p>
        <ul>
          <li><a href="/api/hello">/api/hello</a> - Test simple</li>
          <li><a href="/api/products">/api/products</a> - Liste des produits</li>
          <li><a href="/api/products/featured">/api/products/featured</a> - Produits mis en avant</li>
          <li><a href="/api/cart">/api/cart</a> - Panier (vide)</li>
          <li><a href="/api/user">/api/user</a> - Utilisateur (non authentifié)</li>
        </ul>
      </body>
    </html>
  `);
});

// Gestion d'erreur générale
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    message: "Erreur interne du serveur",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Export pour Vercel
export default app;
