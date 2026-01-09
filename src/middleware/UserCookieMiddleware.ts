import { v4 as uuidv4 } from "uuid";

const COOKIE_NAME = "user_id";

export async function getOrSetUserCookie(
  request: Request
): Promise<{ cookie: string; user: any }> {
  const cookieHeader = request.headers.get("cookie") || "";
  let cookie = "";

  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (match) {
    cookie = match[1];
  }

  // If no cookie, create one
  if (!cookie) {
    cookie = uuidv4();
  }

  return { cookie, user: null };
}

export function setUserCookieHeader(cookie: string): Headers {
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${cookie}; Path=/; HttpOnly; SameSite=Lax`
  );
  return headers;
}
