import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { logger } from "hono/logger";
import { pagesRouter } from "./routes/pages";
import { menuRouter } from "./routes/menu";
import { cacheRouter } from "./routes/cache";
import { gameRouter } from "./routes/game";
import { leaderboardRouter } from "./routes/leaderboard";
import { userRouter } from "./routes/user";

const app = new Hono();

app.use(logger());

// Serve static files from public directory
app.use("/*", serveStatic({ root: "./public" }));

// Health check
app.get("/alive", (c) => c.json({ alive: true }));

// Mount routers
app.route("/", pagesRouter);
app.route("/", menuRouter);
app.route("/", cacheRouter);
app.route("/", gameRouter);
app.route("/", leaderboardRouter);
app.route("/", userRouter);

console.log(`🔥 Server running on http://localhost:3000`);

export default app;
