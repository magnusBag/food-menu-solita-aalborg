import fs from "fs";
import path from "path";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { logger } from "hono/logger";
import { drizzle } from "drizzle-orm/node-postgres";
import { MenuService } from "./kanpla/MenuService";
import { cacheMiddleware } from "./middleware/CacheMiddleware";
import { getOrSetUser } from "./middleware/UserCookie";
import { users } from "./db/schema";
import { desc, eq } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL!);

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
  const { getCacheSize } = await import("./middleware/CacheMiddleware");
  return c.json({
    size: getCacheSize(),
    message: "Cache status retrieved successfully",
  });
});

app.delete("/cache/clear", async (c) => {
  const { clearCache } = await import("./middleware/CacheMiddleware");
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
//leaderboard page route
app.get("/leaderboard", async (c) => {
  const html = fs.readFileSync(
    path.join(process.cwd(), "public", "leaderboard.html"),
    "utf8"
  );
  return c.html(html);
});
// Leaderboard API route
app.get("/leaderboard/api", async (c) => {
  const results = await db
    .select({ score: users.score, userName: users.userName })
    .from(users)
    .orderBy(desc(users.score));
  return c.json(results);
});

// Secure score endpoints using HttpOnly cookies

// Get score and username
app.get("/score", async (c) => {
  const user = await getOrSetUser(c, db);
  return c.json({
    score: user?.score ?? 0,
    userName: user?.userName ?? "Guest",
  });
});

// Set username for current user
app.post("/user/name", async (c) => {
  const user = await getOrSetUser(c, db);
  if (!user) return c.json({ error: "User not found" }, 400);
  const { userName } = await c.req.json();
  if (
    !userName ||
    typeof userName !== "string" ||
    userName.length < 2 ||
    userName.length > 32
  ) {
    return c.json({ error: "Invalid username" }, 400);
  }
  await db.update(users).set({ userName }).where(eq(users.cookie, user.cookie));
  return c.json({ success: true, userName });
});

app.post("/score/increment", async (c) => {
  const user = await getOrSetUser(c, db);
  if (!user) return c.json({ error: "User not found" }, 400);
  const newScore = (user.score ?? 0) + 1;
  if (user.id === 4) {
    return c.json(
      {
        score: -1,
        message: "You are not allowed to increment the score.",
      },
      403
    );
  }
  await db
    .update(users)
    .set({ score: newScore })
    .where(eq(users.cookie, user.cookie));
  return c.json({ score: newScore });
});

app.post("/score/decrement", async (c) => {
  const user = await getOrSetUser(c, db);
  if (!user) return c.json({ error: "User not found" }, 400);
  const newScore = Math.max(0, (user.score ?? 0) - 1);
  await db
    .update(users)
    .set({ score: newScore })
    .where(eq(users.cookie, user.cookie));
  return c.json({ score: newScore });
});

export default app;
