import { Hono } from "hono";
import { GameService } from "../services/GameService";
import { getMenuService } from "../kanpla/MenuService";
import { getOrSetUserCookie } from "../middleware/UserCookieMiddleware";
import { getOrCreateUser, updateUser } from "../storage/azureUserStore";

export const gameRouter = new Hono();
const menuService = getMenuService();
const gameService = new GameService(() => menuService.getAllMenuItems(), {
  roundTtlMs: 5000,
});

gameRouter.post("/game/start", async (c) => {
  const { cookie } = await getOrSetUserCookie(c.req.raw);
  const user = await getOrCreateUser(cookie);
  const round = await gameService.start(user.cookie);
  return c.json(round);
});

gameRouter.post("/game/next", async (c) => {
  const { cookie } = await getOrSetUserCookie(c.req.raw);
  const user = await getOrCreateUser(cookie);
  const round = await gameService.next(user.cookie);
  if (!round) return c.json({ error: "Active round not completed" }, 400);
  return c.json(round);
});

gameRouter.post("/game/answer", async (c) => {
  const { cookie } = await getOrSetUserCookie(c.req.raw);
  const user = await getOrCreateUser(cookie);
  const { roundId, optionId } = await c.req.json();
  if (!roundId || !optionId) {
    return c.json({ error: "roundId and optionId are required" }, 400);
  }
  const result = gameService.answer(user.cookie, roundId, optionId);
  if ("error" in result) return c.json(result, 400);
  const updated = await updateUser(cookie, (u) => ({
    ...u,
    score: result.correct ? (u.score ?? 0) + 1 : 0,
  }));
  return c.json({ correct: result.correct, score: updated.score });
});
