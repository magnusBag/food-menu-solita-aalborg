import React from 'react';
import { Menu } from './public/menu';
import { renderToString } from 'react-dom/server';
import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { MenuService } from './src/MenuService';

const menuService = new MenuService();

const app = new Elysia()
  .use(staticPlugin())
  // Welcome page route
  // API routes
  .get('/', async ({ set }) => {
    set.headers['Content-Type'] = 'text/html';
    const menu = await menuService.getAllMenuItems();
    return renderToString(<Menu title="Welcome to the Menu" message="This is a message from the Menu" menuItems={menu} />);
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