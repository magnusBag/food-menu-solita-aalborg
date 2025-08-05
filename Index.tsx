import React from 'react';
import { Menu } from './public/menu';
import { renderToString } from 'react-dom/server';
import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { MenuService } from './src/MenuService';
import fs from 'fs';
import path from 'path';

const menuService = new MenuService();


const app = new Elysia()
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
          <div class="settings-dropdown">
            <button class="settings-toggle" id="settings-toggle" aria-label="Open settings">
              ⚙️
            </button>
            <div class="settings-menu" id="settings-menu">
              <div class="settings-item">
                <label for="theme-toggle">Theme:</label>
                <button class="theme-toggle" id="theme-toggle" aria-label="Toggle dark mode">
                  🌙
                </button>
              </div>
              <div class="settings-item">
                <label for="compact-toggle">View:</label>
                <button class="compact-toggle" id="compact-toggle" aria-label="Toggle compact view">
                  Normal View
                </button>
              </div>
              <div class="settings-item">
                <label for="border-radius-slider">Border Radius:</label>
                <div class="slider-container">
                  <input
                    type="range"
                    id="border-radius-slider"
                    min="0"
                    max="30"
                    value="15"
                    class="radius-slider"
                    aria-label="Adjust border radius"
                  >
                  <span class="slider-value" id="slider-value">15px</span>
                </div>
              </div>
            </div>
          </div>
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

            // Function to set compact view
            function setCompactView(isCompact) {
              const container = document.querySelector('.container');
              const dateGroups = document.querySelectorAll('.dateGroup');
              const grids = document.querySelectorAll('.grid');
              const cards = document.querySelectorAll('.card');
              const toggleBtn = document.getElementById('compact-toggle');

              if (isCompact) {
                container.classList.add('compactView');
                dateGroups.forEach(group => group.classList.add('compact'));
                grids.forEach(grid => grid.classList.add('compact'));
                cards.forEach(card => card.classList.add('compact'));
                toggleBtn.textContent = 'Compact View';
                toggleBtn.setAttribute('data-compact-view', 'true');
              } else {
                container.classList.remove('compactView');
                dateGroups.forEach(group => group.classList.remove('compact'));
                grids.forEach(grid => grid.classList.remove('compact'));
                cards.forEach(card => card.classList.remove('compact'));
                toggleBtn.textContent = 'Normal View';
                toggleBtn.setAttribute('data-compact-view', 'false');
              }

              localStorage.setItem('compactView', isCompact.toString());
            }

            // Function to toggle compact view
            function toggleCompactView() {
              const currentCompact = localStorage.getItem('compactView') === 'true';
              setCompactView(!currentCompact);
            }

            // Function to toggle settings menu
            function toggleSettingsMenu() {
              const menu = document.getElementById('settings-menu');
              menu.classList.toggle('open');
            }

            // Function to close settings menu when clicking outside
            function closeSettingsMenu(event) {
              const dropdown = document.querySelector('.settings-dropdown');
              const menu = document.getElementById('settings-menu');

              if (!dropdown.contains(event.target) && menu.classList.contains('open')) {
                menu.classList.remove('open');
              }
            }

            // Function to set border radius
            function setBorderRadius(value) {
              document.documentElement.style.setProperty('--border-radius', value + 'px');
              localStorage.setItem('borderRadius', value.toString());

              // Update slider value display
              const sliderValue = document.getElementById('slider-value');
              if (sliderValue) {
                sliderValue.textContent = value + 'px';
              }
            }

            // Function to handle border radius slider change
            function handleBorderRadiusChange(event) {
              const value = event.target.value;
              setBorderRadius(value);
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

              // Initialize compact view
              const savedCompactView = localStorage.getItem('compactView') === 'true';
              setCompactView(savedCompactView);

              // Initialize border radius
              const savedBorderRadius = localStorage.getItem('borderRadius') || '15';
              const borderRadiusSlider = document.getElementById('border-radius-slider');
              if (borderRadiusSlider) {
                borderRadiusSlider.value = savedBorderRadius;
                setBorderRadius(savedBorderRadius);
              }

              // Add event listener for the settings toggle button
              document.getElementById('settings-toggle').addEventListener('click', toggleSettingsMenu);

              // Add event listener for the theme toggle button
              document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

              // Add event listener for the compact view toggle button
              document.getElementById('compact-toggle').addEventListener('click', toggleCompactView);

              // Add event listener for the border radius slider
              document.getElementById('border-radius-slider').addEventListener('input', handleBorderRadiusChange);

              // Close settings menu when clicking outside
              document.addEventListener('click', closeSettingsMenu);

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
  }).get('/menu', async ({ set }) => {
    const menu = await menuService.getAllMenuItems();
    return menu;
  })
  .get('/game', async ({ set }) => {
    // return the game.html file
    set.headers['Content-Type'] = 'text/html; charset=utf-8';
    return fs.readFileSync(path.join(__dirname, 'public', 'game.html'), 'utf8');
  })
  .listen(3000);

console.log(`🦊 Server is running at http://localhost:${app.server?.port}`);
