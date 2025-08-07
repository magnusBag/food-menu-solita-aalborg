import { Hono } from "hono";
import { drizzle } from "drizzle-orm/node-postgres";
import { users } from "../db/schema";
import { desc } from "drizzle-orm";

export const leaderboardRouter = new Hono();

const db = drizzle(process.env.DATABASE_URL!);

leaderboardRouter.get("/leaderboard/api", async (c) => {
  const results = await db
    .select({ score: users.score, userName: users.userName })
    .from(users)
    .orderBy(desc(users.score));
  return c.json(results);
});
