import { Hono } from "hono";
import { drizzle } from "drizzle-orm/node-postgres";
import { getOrSetUser } from "../middleware/UserCookie";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

export const userRouter = new Hono();

const db = drizzle(process.env.DATABASE_URL!);

function sanitizeUserName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2 || trimmed.length > 22) return null;
  const allowed = /^[\p{L}\p{N} _'’.\-]{2,22}$/u;
  if (!allowed.test(trimmed)) return null;
  return trimmed;
}

userRouter.get("/score", async (c) => {
  const user = await getOrSetUser(c, db);
  return c.json({
    score: user?.score ?? 0,
    userName: user?.userName ?? "Guest",
  });
});

userRouter.post("/user/name", async (c) => {
  const user = await getOrSetUser(c, db);
  if (!user) return c.json({ error: "User not found" }, 400);
  const { userName } = await c.req.json();
  const clean = sanitizeUserName(userName);
  if (!clean) return c.json({ error: "Invalid username" }, 400);
  await db
    .update(users)
    .set({ userName: clean })
    .where(eq(users.cookie, user.cookie));
  return c.json({ success: true, userName: clean });
});
