import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Uniquement pour le développement
  log("Development mode with Vite middleware is disabled in this version");
  log("Frontend will be served from a separate server");
  
  // Renvoyer une page simple pour indiquer que le serveur API est actif
  app.use("*", (req, res, next) => {
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
          <p>Le serveur API est en cours d'exécution.</p>
          <p>Endpoints API accessibles à <code>/api/*</code></p>
        </body>
      </html>
    `);
  });
}

export function serveStatic(app: Express) {
  // En production, la page d'accueil simple pour l'API
  app.get("/", (req, res) => {
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
          <p>Le serveur API est en cours d'exécution.</p>
          <p>Endpoints API accessibles à <code>/api/*</code></p>
        </body>
      </html>
    `);
  });
  
  // Capture toutes les autres routes non-API
  app.use("*", (req, res, next) => {
    if (req.originalUrl.startsWith("/api")) {
      next();
      return;
    }
    
    res.status(404).send(`
      <html>
        <head>
          <title>404 - Page non trouvée</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
            h1 { color: #e00; }
          </style>
        </head>
        <body>
          <h1>404 - Page non trouvée</h1>
          <p>L'URL demandée n'existe pas sur ce serveur.</p>
          <p>Ce serveur héberge uniquement l'API SportMarocShop.</p>
        </body>
      </html>
    `);
  });
}
