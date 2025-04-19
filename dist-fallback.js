/**
 * Fichier de fallback pour Vercel en cas d'erreur avec l'application principale
 */
import express from 'express';
import cors from 'cors';

const app = express();

// Configuration CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware pour le parsing JSON
app.use(express.json());

// Route de santé
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    environment: process.env.NODE_ENV || 'development',
    message: 'Serveur de fallback actif - en attente de connexion à la base de données',
    serverTime: new Date().toISOString()
  });
});

// Route par défaut pour API
app.all('/api/*', (req, res) => {
  res.status(503).json({
    status: 'ERROR',
    message: 'Service temporairement indisponible - Le serveur est en cours de démarrage ou de configuration',
    path: req.path,
    method: req.method,
    serverTime: new Date().toISOString()
  });
});

// Route par défaut pour tout autre chemin
app.all('*', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'API de SportMaroc Shop - En cours de démarrage',
    docs: '/api/docs',
    health: '/api/health'
  });
});

export default app; 