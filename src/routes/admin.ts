import { Hono } from "hono";
import { getMenuService } from "../kanpla/MenuService";

export const adminRouter = new Hono();

const menuService = getMenuService();

// Secret endpoint to regenerate all images
// Use a secret token to protect this endpoint
adminRouter.post("/admin/remake-images", async (c) => {
  // Check for authorization token
  const authHeader = c.req.header("Authorization");
  const secretToken = process.env.ADMIN_SECRET_TOKEN;

  if (!secretToken) {
    return c.json(
      { error: "Admin secret token not configured on server" },
      500
    );
  }

  if (!authHeader || authHeader !== `Bearer ${secretToken}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    // Start the image regeneration process
    const result = await menuService.remakeAllImages();

    return c.json({
      message: "Image regeneration completed",
      ...result,
    });
  } catch (error) {
    console.error("Error in remake-images endpoint:", error);
    return c.json({ error: "Failed to regenerate images" }, 500);
  }
});
