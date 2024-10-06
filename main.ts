import { Application, Router } from "jsr:@oak/oak/";
import { foodAndCoNorth } from "./foodAndCoNorth.ts";
import { foodAndCoNorthNiceFormat } from "./foodAndCoNorthNiceFormat.ts";

const app = new Application();
const router = new Router();
router
  .get("/", async (context) => {
    const response = await foodAndCoNorthNiceFormat();
    context.response.headers.set("Content-Type", "text/html");
    context.response.body = response.body;
  })
  .get("/json-format", async (context) => {
    const response = await foodAndCoNorth();
    context.response.headers.set("Content-Type", "application/json");
    context.response.body = response.body;
  })

app.use(router.routes());
app.use(router.allowedMethods());

app.use((context) => {
  context.response.status = 404;
  context.response.body = "Not Found";
});

const serverPort = Deno.args.length > 0 ? parseInt(Deno.args[0]) : 8000;
console.log(`HTTP webserver running. Access it at: http://localhost:${serverPort}/`);

await app.listen({ port: serverPort });