import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// You may need to adjust this import to your DB connection
import { drizzle } from "drizzle-orm/node-postgres";

const db = drizzle(process.env.DATABASE_URL!);

export async function getOrSetUserCookie(
  request: Request
): Promise<{ cookie: string; user: any }> {
  const cookieHeader = request.headers.get("cookie") || "";
  let cookie = "";
  let user = null;

  // Try to find the user cookie
  const match = cookieHeader.match(/user_id=([^;]+)/);
  if (match) {
    cookie = match[1];
    // Find user in DB
    const result = await db
      .select()
      .from(users)
      .where(eq(users.cookie, cookie));
    user = result[0] || null;
  }

  // If no cookie or user, create one
  if (!cookie || !user) {
    cookie = uuidv4();
    await db.insert(users).values({ cookie }).onConflictDoNothing();
    const result = await db
      .select()
      .from(users)
      .where(eq(users.cookie, cookie));
    user = result[0] || null;
  }

  return { cookie, user };
}

export function setUserCookieHeader(cookie: string): Headers {
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `user_id=${cookie}; Path=/; HttpOnly; SameSite=Lax`
  );
  return headers;
}
