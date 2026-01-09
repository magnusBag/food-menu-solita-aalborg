import { Hono } from "hono";
import { getOrSetUserCookie } from "../middleware/UserCookieMiddleware";
import { getOrCreateUser, updateUser } from "../storage/azureUserStore";

export const userRouter = new Hono();

function sanitizeUserName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2 || trimmed.length > 22) return null;
  const allowed = /^[\p{L}\p{N} _'’.\-]{2,22}$/u;
  if (!allowed.test(trimmed)) return null;
  return trimmed;
}

userRouter.get("/score", async (c) => {
  const { cookie } = await getOrSetUserCookie(c.req.raw);
  const user = await getOrCreateUser(cookie);
  return c.json({
    score: user?.score ?? 0,
    userName: user?.userName ?? "Guest",
  });
});

userRouter.post("/user/name", async (c) => {
  const { cookie } = await getOrSetUserCookie(c.req.raw);
  const { userName } = await c.req.json();
  const clean = sanitizeUserName(userName);
  if (!clean) return c.json({ error: "Invalid username" }, 400);
  await updateUser(cookie, (u) => ({ ...u, userName: clean }));
  return c.json({ success: true, userName: clean });
});
