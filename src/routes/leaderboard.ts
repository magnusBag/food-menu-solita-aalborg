import { Hono } from "hono";
import { getAllUsers } from "../storage/azureUserStore";

export const leaderboardRouter = new Hono();

leaderboardRouter.get("/leaderboard/api", async (c) => {
  const { users } = await getAllUsers();
  const results = Object.values(users).sort((a, b) => b.score - a.score);
  return c.json(results.map((u) => ({ score: u.score, userName: u.userName })));
});
