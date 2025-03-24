import { Pool } from "pg";
import { MenuItem } from "../models/menu";
import { getMenu } from "./getMenu";

export class MenuService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.conn_string,
    });
    this.initializeTable();

    // refresh the menu once a week
    setInterval(async () => {
      await this.refreshMenu();
    }, 1000 * 60 * 60 * 24 * 7);
    this.refreshMenu();
  }

  private async refreshMenu(): Promise<void> {
    const menu = await getMenu();
    // After all items are loaded, get all existing items and make sure we dont load the same items twice
    const existingItems = await this.getAllMenuItems();
    const filteredMenu = menu.filter(
      (item) =>
        !existingItems.some((existingItem) => existingItem.name === item.name)
    );

    const savedItems: MenuItem[] = [];
    for (const item of filteredMenu) {
      item.imageurl = await this.makeImage(item);
      const savedItem = await this.saveMenuItem(item);
      if (savedItem) savedItems.push(savedItem);
    }

    console.log(`Refreshed menu with ${savedItems.length} items`);
  }

  private async makeImage(item: MenuItem): Promise<string> {
    // Call OpenAI DALL-E 3 to make an image based on the menu item description
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;

      if (!openaiApiKey) {
        console.error(
          "OpenAI API key not found in environment variables. Set OPENAI_API_KEY in your .env file."
        );
        return this.getDefaultImageUrl();
      }

      const prompt = `A professional, appetizing food photograph of ${
        item.name
      }. ${item.description || ""}`;

      // Retry logic for rate limiting
      const maxRetries = 3;
      let retryCount = 0;
      let success = false;
      let imageUrl;

      while (!success && retryCount <= maxRetries) {
        const response = await fetch(
          "https://api.openai.com/v1/images/generations",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiApiKey}`,
            },
            body: JSON.stringify({
              model: "dall-e-3",
              prompt,
              n: 1,
              size: "1024x1024",
              quality: "standard",
            }),
          }
        );

        if (response.status === 408 || response.status === 429) {
          // Rate limit hit, wait and retry
          retryCount++;
          if (retryCount <= maxRetries) {
            console.log(
              `Rate limit hit, waiting 60 seconds before retry ${retryCount}/${maxRetries}...`
            );
            await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait 1 minute
            continue;
          } else {
            console.error("Max retries reached for rate limiting");
            return this.getDefaultImageUrl();
          }
        } else if (!response.ok) {
          const errorData = await response.json();
          console.error("Error generating image with DALL-E:", errorData);
          return this.getDefaultImageUrl();
        }

        const data = await response.json();
        const tempImageUrl = data.data[0].url;
        success = true;
        imageUrl = tempImageUrl;

        // Try to upload to Azure Blob Storage if SAS URL is available
        const sasUrl = process.env.AZURE_STORAGE_CONNECTION_STRING;
        if (sasUrl) {
          try {
            // Check if the provided string is a SAS URL

            // Create a unique blob name
            const blobName = `${item.name.replace(/[^a-zA-Z0-9]/g, "-")}.png`;

            // Download the image from OpenAI
            console.log("Downloading image from OpenAI...");
            const imageResponse = await fetch(tempImageUrl);
            if (!imageResponse.ok) {
              throw new Error(
                `Failed to download image from OpenAI: ${imageResponse.statusText}`
              );
            }
            const imageBuffer = await imageResponse.arrayBuffer();

            // Extract container name from SAS URL
            const sasUrlObj = new URL(decodeURIComponent(sasUrl));
            const containerName = sasUrlObj.pathname.split("/")[1]; // Extract container name from path

            // Create the full blob URL with SAS token for the new blob
            const blobSasUrl = `${sasUrlObj.origin}/${containerName}/${blobName}${sasUrlObj.search}`;

            console.log(
              `Uploading image for '${item.name}' to blob storage...`
            );

            // Use fetch to upload directly with the SAS URL
            const uploadResponse = await fetch(blobSasUrl, {
              method: "PUT",
              headers: {
                "Content-Type": "image/png",
                "x-ms-blob-type": "BlockBlob",
              },
              body: imageBuffer,
            });

            if (!uploadResponse.ok) {
              throw new Error(
                `Failed to upload to Blob Storage: ${uploadResponse.status} ${uploadResponse.statusText}`
              );
            }

            // Get the URL of the uploaded blob (without the SAS token for public access)
            const publicBlobUrl = `${sasUrlObj.origin}/${containerName}/${blobName}`;
            imageUrl = publicBlobUrl;
            console.log(`Image uploaded successfully to: ${publicBlobUrl}`);
          } catch (uploadError) {
            console.error(
              "Error uploading image to Blob Storage:",
              uploadError
            );
            console.log("Using temporary OpenAI URL instead.");
            // Continue with the temporary URL from OpenAI
          }
        } else {
          console.log(
            "Azure Storage SAS URL not provided. Using temporary OpenAI URL."
          );
          console.log(
            "To enable persistent storage, set AZURE_STORAGE_CONNECTION_STRING in your .env file."
          );
        }
      }

      return imageUrl || this.getDefaultImageUrl();
    } catch (error) {
      console.error("Error generating image:", error);
      return this.getDefaultImageUrl();
    }
  }

  private getDefaultImageUrl(): string {
    return `https://images.immediate.co.uk/production/volatile/sites/30/2020/08/chorizo-mozarella-gnocchi-bake-cropped-9ab73a3.jpg?resize=768,574`;
  }

  private async initializeTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        date VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(100),
        imageurl VARCHAR(500)
      );
    `;

    try {
      await this.pool.query(createTableQuery);
    } catch (error) {
      console.error("Error initializing table:", error);
    }
  }

  async saveMenuItem(item: MenuItem): Promise<MenuItem | null> {
    const query = `
      INSERT INTO menu_items (name, date, description, type, imageUrl)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (name) DO NOTHING
      RETURNING *;
    `;

    try {
      const result = await this.pool.query(query, [
        item.name,
        item.date,
        item.description,
        item.type,
        item.imageurl,
      ]);

      return result.rows[0] || null;
    } catch (error) {
      console.error("Error saving menu item:", error);
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
    const query = "SELECT * FROM menu_items ORDER BY date DESC;";

    try {
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      console.error("Error fetching menu items:", error);
      return [];
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
