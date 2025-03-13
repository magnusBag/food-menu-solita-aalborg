import React from 'react';
import { Menu } from './public/menu';
import { renderToString } from 'react-dom/server';
import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { MenuService } from './src/MenuService';
import fs from 'fs';
import path from 'path';

const menuService = new MenuService();

// Read the CSS file
const cssFilePath = path.join(process.cwd(), 'public', 'menu.css');
const cssContent = fs.readFileSync(cssFilePath, 'utf8');

const app = new Elysia()
  .use(staticPlugin())
  // Welcome page route
  // API routes
  .get('/', async ({ set }) => {
    set.headers['Content-Type'] = 'text/html; charset=utf-8';
    const menu = await menuService.getAllMenuItems();
    const menuHtml = renderToString(<Menu title="Welcome to the Menu" message="This is a message from the Menu" menuItems={menu} />);
    
    // Create a complete HTML document with the CSS included
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Menu</title>
          <style>
            ${cssContent}
          </style>
        </head>
        <body>
          ${menuHtml}
        </body>
      </html>
    `;
    
    return html;
  })
  .get('/api/hello', () => {
    return {
      message: 'Hello from the Bun API server!'
    };
  })
  .get('/api/time', () => {
    return {
      time: new Date().toISOString(),
      timestamp: Date.now()
    };
  })
  .post('/api/echo', ({ body }) => {
    return {
      echoed: body
    };
  })
  .listen(3000);

console.log(`🦊 Server is running at http://localhost:${app.server?.port}`);