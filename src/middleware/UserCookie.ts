import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// Helper to get or set user cookie and ensure user exists in DB
export async function getOrSetUser(c: any, db: any) {
  let cookie = c.req.header("cookie")?.match(/user_id=([^;]+)/)?.[1];
  let user;

  if (cookie) {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.cookie, cookie));
    user = result[0];
  }

  if (!cookie || !user) {
    cookie = uuidv4();
    await db.insert(users).values({ cookie }).onConflictDoNothing();
    const result = await db
      .select()
      .from(users)
      .where(eq(users.cookie, cookie));
    user = result[0];
    c.header("Set-Cookie", `user_id=${cookie}; Path=/; HttpOnly; SameSite=Lax`);
  }

  return user;
}
