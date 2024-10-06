import { foodAndCoNorth } from "./foodAndCoNorth.ts";
import { foodAndCoNorthNiceFormat } from "./foodAndCoNorthNiceFormat.ts";

const handler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  
  
  if (url.pathname === "/") {
    return await foodAndCoNorthNiceFormat(request);
  }
  
  
  if (url.pathname === "/json-format") {
    return await foodAndCoNorth(request);
  }
  
  return new Response("Not Found", { status: 404 });
};

const serverPort = Deno.args.length > 0 ? parseInt(Deno.args[0]) : 8000;
console.log(`HTTP webserver running. Access it at: http://localhost:${serverPort}/`);
await Deno.serve({ port: serverPort }, handler);