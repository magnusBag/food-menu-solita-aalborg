
const port = 8000;

const handler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  
  if (url.pathname === "/" || url.pathname === "/index.html") {
    const html = await Deno.readTextFile("./index.html");
    return new Response(html, {
      headers: { "content-type": "text/html" },
    });
  }
  
  return new Response("Not Found", { status: 404 });
};

console.log(`HTTP webserver running. Access it at: http://localhost:${port}/`);
await Deno.serve({ port }, handler);