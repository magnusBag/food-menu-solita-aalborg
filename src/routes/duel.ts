import { Hono } from "hono";
import { DuelService } from "../services/DuelService";
import { getOrSetUser } from "../middleware/UserCookie";
import { drizzle } from "drizzle-orm/node-postgres";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { getMenuService } from "../kanpla/MenuService";

export const duelRouter = new Hono();

const db = drizzle(process.env.DATABASE_URL!);
const menuService = getMenuService();
const duelService = new DuelService(() => menuService.getAllMenuItems(), {
  roundTtlMs: 5000,
});

duelRouter.post("/duel/create", async (c) => {
  const user = await getOrSetUser(c, db);
  const state = await db
    .select({ score: users.score, userName: users.userName })
    .from(users)
    .where(eq(users.cookie, user.cookie));
  const { score, userName } = state[0] ?? { score: 0, userName: "Guest" };
  const room = duelService.create(user.cookie, userName, score);
  return c.json({ duelId: room.id });
});

duelRouter.post("/duel/join/:id", async (c) => {
  const user = await getOrSetUser(c, db);
  const id = c.req.param("id");
  const state = await db
    .select({ score: users.score, userName: users.userName })
    .from(users)
    .where(eq(users.cookie, user.cookie));
  const { score, userName } = state[0] ?? { score: 0, userName: "Guest" };
  const room = duelService.join(id, user.cookie, userName, score);
  if (!room)
    return c.json(
      { error: "Duel not found, already has guest, or you are the host" },
      400
    );
  return c.json({ ok: true });
});

duelRouter.get("/duel/state/:id", (c) => {
  const id = c.req.param("id");
  const state = duelService.getState(id);
  if (!state) return c.json({ error: "Duel not found" }, 404);
  return c.json(state);
});

duelRouter.post("/duel/start/:id", async (c) => {
  const id = c.req.param("id");
  const state = await duelService.startRound(id);
  if (!state) return c.json({ error: "Duel not found" }, 404);
  return c.json(state);
});

duelRouter.post("/duel/answer/:id", async (c) => {
  const user = await getOrSetUser(c, db);
  const id = c.req.param("id");
  const { roundId, optionId } = await c.req.json();
  if (!roundId || !optionId)
    return c.json({ error: "roundId and optionId are required" }, 400);
  const result = duelService.answer(id, user.cookie, roundId, optionId);
  if ("error" in result) return c.json(result, 400);
  return c.json(result);
});

duelRouter.get("/duel/stream/:id", async (c) => {
  const id = c.req.param("id");
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      };
      const unsubscribe = duelService.subscribe(id, (state) => send(state));
      const heartbeat = setInterval(
        () => controller.enqueue(":keepalive\n\n"),
        15000
      );
      // @ts-ignore
      c.req.raw.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      });
    },
  });
  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");
  return new Response(stream);
});
