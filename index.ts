import dotenv from 'dotenv';
dotenv.config();
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cors from 'cors';
import session from 'express-session';
import MemoryStore from 'memorystore';
import { testConnection } from './db';

const MemoryStoreSession = MemoryStore(session);

// Créer l'application Express
const app = express();

// Configuration CORS pour autoriser les requêtes depuis le frontend
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://sportmarocshop.vercel.app', 'https://sportmarocshop-git-main-yourusername.vercel.app'] 
    : 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Configuration de session compatible avec Vercel Serverless
app.use(session({
  secret: process.env.SESSION_SECRET || 'sportmarocshop-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  },
  store: new MemoryStoreSession({
    checkPeriod: 86400000 // 24 heures en millisecondes
  })
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Middleware de logging
app.use((req, res, next) => {
  try {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  } catch (error) {
    next(error);
  }
});

// Route de vérification d'état pour Vercel
app.get('/api/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    res.status(200).json({ 
      status: 'OK', 
      environment: process.env.NODE_ENV,
      database: dbConnected ? 'connected' : 'disconnected'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      message: 'Health check failed',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Initialiser les routes
registerRoutes(app);

// Gestionnaire d'erreurs global
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Error caught by global error handler:", err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({ 
    message, 
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined 
  });
});

// Gestionnaire de route non trouvée
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});

// Tester la connexion à la base de données au démarrage
(async () => {
  try {
    await testConnection();
    console.log('Database connection verified at startup');
  } catch (error) {
    console.error('Failed to connect to database at startup:', error);
    // Nous ne quittons pas l'application mais nous enregistrons l'erreur
  }
})();

// En mode développement, configurer Vite
if (process.env.NODE_ENV === "development") {
  // Créer le serveur HTTP uniquement en développement
  const server = app.listen(5000, () => {
    console.log(`Server started on port 5000`);
  });
  setupVite(app, server);
} else {
  // En production sur Vercel, pas besoin de créer le serveur HTTP
  serveStatic(app);
}

// Exporter l'app Express pour Vercel
export default app;
