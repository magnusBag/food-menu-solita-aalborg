import { Pool } from 'pg';
import { MenuItem } from '../models/menu';
import { getMenu } from './getMenu';


export class MenuService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.conn_string
    });
    this.initializeTable();
    // refresh the menu once a week
    setInterval(async () => {
      await this.refreshMenu();
    }, 1000 * 60 * 60 * 24 * 7);
  }

  private async refreshMenu(): Promise<void> {
    const menu = await getMenu();
    
    const savedItems: MenuItem[] = [];
    for (const item of menu) {
      const savedItem = await this.saveMenuItem(item);
      if (savedItem)
        savedItems.push(savedItem);
    }
    console.log(`Refreshed menu with ${savedItems.length} items`);
  }

  private async initializeTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        date VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(100)
      );
    `;

    try {
      await this.pool.query(createTableQuery);
    } catch (error) {
      console.error('Error initializing table:', error);
    }
  }

  async saveMenuItem(item: MenuItem): Promise<MenuItem | null> {
    const query = `
      INSERT INTO menu_items (name, date, description, type)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (name) DO NOTHING
      RETURNING *;
    `;

    try {
      const result = await this.pool.query(query, [
        item.name,
        item.date,
        item.description,
        item.type
      ]);
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error saving menu item:', error);
      return null;
    }
  }

  async saveMenuItems(items: MenuItem[]): Promise<MenuItem[]> {
    const savedItems: MenuItem[] = [];
    
    for (const item of items) {
      const savedItem = await this.saveMenuItem(item);
      if (savedItem) {
        savedItems.push(savedItem);
      }
    }
    
    return savedItems;
  }

  async getAllMenuItems(): Promise<MenuItem[]> {
    const query = 'SELECT * FROM menu_items ORDER BY date DESC;';
    
    try {
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error fetching menu items:', error);
      return [];
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
} 

