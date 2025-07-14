import React from 'react';
import { Menu } from './public/menu';
import { renderToString } from 'react-dom/server';
import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { MenuService } from './src/MenuService';

const menuService = new MenuService();


const app = new Elysia()
  .use(staticPlugin())
  .use(staticPlugin({ assets: 'public', prefix: '' }))
  // Welcome page route
  // API routes
  .get('/', async ({ set }) => {
    set.headers['Content-Type'] = 'text/html; charset=utf-8';
    const menu = await menuService.getAllMenuItems();
    const menuHtml = renderToString(<Menu title="Welcome to the Menu" menuItems={menu} />);

    // Create a complete HTML document with the CSS included
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Menu</title>
          <link rel="stylesheet" href="/menu.css">
        </head>
        <body>
          <button class="theme-toggle" id="theme-toggle" aria-label="Toggle dark mode">
            🌙
          </button>
          ${menuHtml}

          <script>
            // Function to set the theme
            function setTheme(theme) {
              document.documentElement.setAttribute('data-theme', theme);
              localStorage.setItem('theme', theme);
              updateToggleButton(theme);
            }

            // Function to update the toggle button icon
            function updateToggleButton(theme) {
              const toggleBtn = document.getElementById('theme-toggle');
              toggleBtn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
              toggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
            }

            // Function to toggle the theme
            function toggleTheme() {
              const currentTheme = localStorage.getItem('theme') || 'light';
              const newTheme = currentTheme === 'light' ? 'dark' : 'light';
              setTheme(newTheme);
            }

            // Initialize theme based on user preference or system preference
            document.addEventListener('DOMContentLoaded', () => {
              const savedTheme = localStorage.getItem('theme');

              if (savedTheme) {
                // Use saved preference if available
                setTheme(savedTheme);
              } else {
                // Check system preference
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                setTheme(prefersDark ? 'dark' : 'light');
              }

              // Add event listener for the toggle button
              document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

              // Listen for system preference changes
              window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                if (!localStorage.getItem('theme')) {
                  setTheme(e.matches ? 'dark' : 'light');
                }
              });
            });
          </script>
        </body>
      </html>
    `;

    return html;
  }).get('/alive', () => {
    return {
      alive: true
    };
  })
  .listen(3000);

console.log(`🦊 Server is running at http://localhost:${app.server?.port}`);
