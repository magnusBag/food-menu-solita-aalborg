import { Hono } from "hono";
import { GameService } from "../services/GameService";
import { getOrSetUser } from "../middleware/UserCookie";
import { drizzle } from "drizzle-orm/node-postgres";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { getMenuService } from "../kanpla/MenuService";

export const gameRouter = new Hono();

const db = drizzle(process.env.DATABASE_URL!);
const menuService = getMenuService();
const gameService = new GameService(() => menuService.getAllMenuItems(), {
  roundTtlMs: 5000,
});

gameRouter.post("/game/start", async (c) => {
  const user = await getOrSetUser(c, db);
  const round = await gameService.start(user.cookie);
  return c.json(round);
});

gameRouter.post("/game/next", async (c) => {
  const user = await getOrSetUser(c, db);
  const round = await gameService.next(user.cookie);
  if (!round) return c.json({ error: "Active round not completed" }, 400);
  return c.json(round);
});

gameRouter.post("/game/answer", async (c) => {
  const user = await getOrSetUser(c, db);
  const { roundId, optionId } = await c.req.json();
  if (!roundId || !optionId) {
    return c.json({ error: "roundId and optionId are required" }, 400);
  }
  const result = gameService.answer(user.cookie, roundId, optionId);
  if ("error" in result) return c.json(result, 400);
  const current = await db
    .select({ score: users.score })
    .from(users)
    .where(eq(users.cookie, user.cookie));
  const currentScore = current[0]?.score ?? 0;
  const newScore = result.correct ? currentScore + 1 : 0;
  await db
    .update(users)
    .set({ score: newScore })
    .where(eq(users.cookie, user.cookie));
  return c.json({ correct: result.correct, score: newScore });
});
