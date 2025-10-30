import { Hono } from "hono";
import { cacheMiddleware } from "../middleware/CacheMiddleware";
import { getMenuService } from "../kanpla/MenuService";
import { drizzle } from "drizzle-orm/node-postgres";
import { menuItemRatings, menuItems } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { getOrSetUser } from "../middleware/UserCookie";
import { Client } from "pg";

export const menuRouter = new Hono();

const menuService = getMenuService();
const ratingClient = new Client({
  connectionString: process.env.DATABASE_URL,
});
await ratingClient.connect();
const ratingDb = drizzle(ratingClient);

menuRouter.get(
  "/menu",
  cacheMiddleware({ ttl: 60 * 1000, maxSize: 50 }),
  async (c) => {
    const menu = await menuService.getAllMenuItems();
    return c.json(menu);
  }
);

menuRouter.get("/menu/ratings", async (c) => {
  const user = await getOrSetUser(c, ratingDb);
  if (!user) {
    return c.json({ ratings: {} });
  }

  const ratings = await ratingDb
    .select({
      menuItemId: menuItemRatings.menuItemId,
      rating: menuItemRatings.rating,
    })
    .from(menuItemRatings)
    .where(eq(menuItemRatings.userId, user.id));

  const formattedRatings: Record<number, number> = {};
  for (const entry of ratings) {
    formattedRatings[entry.menuItemId] = entry.rating;
  }

  return c.json({ ratings: formattedRatings });
});

menuRouter.post("/menu/:id/rating", async (c) => {
  const rawId = c.req.param("id");
  const menuItemId = Number.parseInt(rawId, 10);
  if (!Number.isFinite(menuItemId)) {
    return c.json({ error: "Invalid menu item id" }, 400);
  }

  let body: { rating?: unknown };
  try {
    body = await c.req.json();
  } catch (error) {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const ratingValue = Number(body?.rating);
  if (!Number.isInteger(ratingValue) || ratingValue < 0 || ratingValue > 5) {
    return c.json({ error: "Rating must be an integer between 0 and 5" }, 400);
  }

  const user = await getOrSetUser(c, ratingDb);
  if (!user) {
    return c.json({ error: "Unable to identify user" }, 500);
  }

  const existingMenuItem = await ratingDb
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(eq(menuItems.id, menuItemId))
    .limit(1);

  if (!existingMenuItem[0]) {
    return c.json({ error: "Menu item not found" }, 404);
  }

  await ratingDb
    .insert(menuItemRatings)
    .values({
      menuItemId,
      userId: user.id,
      rating: ratingValue,
    })
    .onConflictDoUpdate({
      target: menuItemRatings.menuItemUserIdx,
      set: { rating: ratingValue },
    });

  const [aggregation] = await ratingDb
    .select({
      averageRating: sql<number>`COALESCE(AVG(${menuItemRatings.rating}), 0)`,
      ratingCount: sql<number>`COUNT(${menuItemRatings.id})`,
    })
    .from(menuItemRatings)
    .where(eq(menuItemRatings.menuItemId, menuItemId));

  const averageRating = Number(aggregation?.averageRating ?? 0);
  const ratingCount = Number(aggregation?.ratingCount ?? 0);

  return c.json({
    success: true,
    averageRating,
    ratingCount,
    userRating: ratingValue,
  });
});
