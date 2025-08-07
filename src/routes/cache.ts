import { Hono } from "hono";

export const cacheRouter = new Hono();

cacheRouter.get("/cache/status", async (c) => {
  const { getCacheSize } = await import("../middleware/CacheMiddleware");
  return c.json({
    size: getCacheSize(),
    message: "Cache status retrieved successfully",
  });
});

cacheRouter.delete("/cache/clear", async (c) => {
  const { clearCache } = await import("../middleware/CacheMiddleware");
  clearCache();
  return c.json({ message: "Cache cleared successfully" });
});
