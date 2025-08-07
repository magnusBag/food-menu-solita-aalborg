import fs from "fs";
import path from "path";
import { Hono } from "hono";

// Serves static HTML pages
export const pagesRouter = new Hono();

pagesRouter.get("/", (c) => {
  const html = fs.readFileSync(
    path.join(process.cwd(), "public", "menu.html"),
    "utf8"
  );
  return c.html(html);
});

pagesRouter.get("/game", (c) => {
  const html = fs.readFileSync(
    path.join(process.cwd(), "public", "game.html"),
    "utf8"
  );
  return c.html(html);
});

pagesRouter.get("/duel", (c) => {
  const html = fs.readFileSync(
    path.join(process.cwd(), "public", "duel.html"),
    "utf8"
  );
  return c.html(html);
});

pagesRouter.get("/leaderboard", (c) => {
  const html = fs.readFileSync(
    path.join(process.cwd(), "public", "leaderboard.html"),
    "utf8"
  );
  return c.html(html);
});
