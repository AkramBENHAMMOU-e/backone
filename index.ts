import dotenv from 'dotenv';
dotenv.config();
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite.js";
import cors from 'cors';
import session from 'express-session';
import pg from 'pg';
import connectPgSimple from 'connect-pg-simple';
import { testConnection } from './db.js';

const PgSession = connectPgSimple(session);

const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Créer l'application Express
const app = express();

// --- CORS Configuration ---
const allowedOrigins = [
  'https://frantone.vercel.app',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Ajouter un middleware pour gérer les requêtes OPTIONS (preflight)
app.options('*', cors());

// --- Session Configuration ---
app.use(session({
  store: new PgSession({
    pool: pgPool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET || 'sportmarocshop-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 30 // 30 days
  }
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false, limit: '5mb' }));

// Middleware de logging simplifié pour Vercel
app.use((req, res, next) => {
  try {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    const start = Date.now();
    const path = req.path;
    
    res.on("finish", () => {
      const duration = Date.now() - start;
      console.log(`${new Date().toISOString()} - ${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    });

    next();
  } catch (error) {
    console.error('Middleware error:', error);
    next(error);
  }
});

// Route de vérification d'état pour Vercel
app.get('/api/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    const responseData = { 
      status: 'OK', 
      environment: process.env.NODE_ENV,
      database: dbConnected ? 'connected' : 'disconnected',
      serverTime: new Date().toISOString()
    };
    console.log('Health check response:', responseData);
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      message: 'Health check failed',
      error: String(error)
    });
  }
});

// Initialiser les routes
try {
  registerRoutes(app);
  console.log('Routes registered successfully');
} catch (error) {
  console.error('Failed to register routes:', error);
}

// Gestionnaire d'erreurs global
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error("Error caught by global error handler:", err);
  console.error("Request path:", req.path);
  console.error("Request method:", req.method);
  console.error("Request headers:", req.headers);
  
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({ 
    message,
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Gestionnaire de route non trouvée
app.use((req: Request, res: Response) => {
  console.log(`Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    message: "Route not found",
    path: req.path
  });
});

// En mode développement, configurer Vite
if (process.env.NODE_ENV === "development") {
  // Créer le serveur HTTP uniquement en développement
  const server = app.listen(5000, () => {
    console.log(`Server started on port 5000`);
    
    // Tester la connexion à la base de données au démarrage en développement
    testConnection().then(connected => {
      console.log(`Database connection test: ${connected ? 'successful' : 'failed'}`);
    }).catch(err => {
      console.error('Database connection test error:', err);
    });
  });
  setupVite(app, server);
} else {
  // En production sur Vercel, pas besoin de créer le serveur HTTP
  serveStatic(app);
  console.log('Server configured for production on Vercel');
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Exporter l'app Express pour Vercel
export default app;
