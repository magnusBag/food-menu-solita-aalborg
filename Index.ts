import { Hono } from "hono";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import { MenuService } from "./src/MenuService";
import { cacheMiddleware } from "./src/CacheMiddleware";
import fs from "fs";
import path from "path";

const menuService = new MenuService();

const app = new Hono();
app.use(logger());

// Serve static files from public directory
app.use("/*", serveStatic({ root: "./public" }));

// Welcome page route
app.get("/", async (c) => {
  const html = fs.readFileSync(
    path.join(process.cwd(), "public", "menu.html"),
    "utf8"
  );
  return c.html(html);
});

// Health check route
app.get("/alive", (c) => {
  return c.json({ alive: true });
});

// Menu API route
app.get(
  "/menu",
  cacheMiddleware({
    ttl: 60 * 60 * 1000, // 60 minutes cache
    maxSize: 50, // Maximum 50 cached entries
  }),
  async (c) => {
    const menu = await menuService.getAllMenuItems();
    return c.json(menu);
  }
);

// Cache management endpoints
app.get("/cache/status", async (c) => {
  const { getCacheSize } = await import("./src/CacheMiddleware");
  return c.json({
    size: getCacheSize(),
    message: "Cache status retrieved successfully",
  });
});

app.delete("/cache/clear", async (c) => {
  const { clearCache } = await import("./src/CacheMiddleware");
  clearCache();
  return c.json({
    message: "Cache cleared successfully",
  });
});

// Game page route
app.get("/game", async (c) => {
  const html = fs.readFileSync(
    path.join(process.cwd(), "public", "game.html"),
    "utf8"
  );
  return c.html(html);
});

export default app;
