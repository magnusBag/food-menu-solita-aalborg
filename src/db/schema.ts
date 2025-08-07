import { pgTable, serial, varchar, text, integer } from "drizzle-orm/pg-core";

export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  date: varchar("date", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 100 }),
  imageurl: varchar("imageurl", { length: 500 }),
});

// Users table for cookie-based identification and score storage
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  cookie: varchar("cookie", { length: 255 }).notNull().unique(),
  score: integer("score").notNull().default(0),
  userName: varchar("user_name", { length: 255 }).notNull().default("Guest"),
});
