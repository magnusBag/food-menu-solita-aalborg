import { Hono } from "hono";
import { cacheMiddleware } from "../middleware/CacheMiddleware";
import { getMenuService } from "../kanpla/MenuService";

export const menuRouter = new Hono();

const menuService = getMenuService();

menuRouter.get(
  "/menu",
  cacheMiddleware({ ttl: 60 * 60 * 1000, maxSize: 50 }),
  async (c) => {
    const menu = await menuService.getAllMenuItems();
    return c.json(menu);
  }
);
