
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

const serverPort = Deno.args.length > 0 ? parseInt(Deno.args[0]) : 8000;
console.log(`HTTP webserver running. Access it at: http://localhost:${serverPort}/`);
await Deno.serve({ port: serverPort }, handler);