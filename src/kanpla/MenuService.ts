import { MenuItem } from "../models/menuItem";
import { getMenu } from "./getMenu";
import { readMenuFromBlob, writeMenuToBlob } from "../storage/azureMenuStore";

export class MenuService {
  private cached: {
    items: MenuItem[];
    etag?: string;
    loadedAtMs: number;
  } | null = null;

  constructor() {
    // refresh the menu every day
    const seconds = Number(process.env.REFRESH_MENU_SEC) || 60 * 60 * 24 * 1;

    const autoRefresh = (process.env.AUTO_REFRESH_MENU ?? "false") !== "false";
    if (autoRefresh) {
      setInterval(async () => {
        await this.refreshMenu();
      }, seconds * 1000);
      this.refreshMenu();
    }
  }

  private async loadMenu(
    force = false
  ): Promise<{ items: MenuItem[]; etag?: string }> {
    const ttlMs = Number(process.env.MENU_CACHE_TTL_MS) || 30_000;
    if (!force && this.cached && Date.now() - this.cached.loadedAtMs < ttlMs) {
      return { items: this.cached.items, etag: this.cached.etag };
    }
    const res = await readMenuFromBlob();
    this.cached = { items: res.items, etag: res.etag, loadedAtMs: Date.now() };
    return res;
  }

  private setCache(items: MenuItem[], etag?: string) {
    this.cached = { items, etag, loadedAtMs: Date.now() };
  }

  private async refreshMenu(): Promise<void> {
    console.log("Starting menu refresh...");
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
        const blobContainerName =
          process.env.AZURE_STORAGE_CONTAINER_NAME || "weekly-food-menu";
        if (sasUrl) {
          try {
            // Check if the provided string is a SAS URL

            // Create a unique blob name
            const blobName = `${blobContainerName}/${item.name.replace(
              /[^a-zA-Z0-9]/g,
              "-"
            )}.png`;

            // Download the image from OpenAI
            console.log("Downloading image from OpenAI...");
            const imageResponse = await fetch(tempImageUrl);
            if (!imageResponse.ok) {
              throw new Error(
                `Failed to download image from OpenAI: ${imageResponse.statusText}`
              );
            }
            const imageBuffer = await imageResponse.arrayBuffer();

            // Extract Blob Endpoint and Container Name
            // If connection string format: BlobEndpoint=...;SharedAccessSignature=...
            let baseUrl = "";
            let sasToken = "";

            if (
              sasUrl.includes("BlobEndpoint=") &&
              sasUrl.includes("SharedAccessSignature=")
            ) {
              const parts = sasUrl.split(";");
              const blobEndpoint = parts
                .find((p) => p.startsWith("BlobEndpoint="))
                ?.slice("BlobEndpoint=".length);
              const sas = parts
                .find((p) => p.startsWith("SharedAccessSignature="))
                ?.slice("SharedAccessSignature=".length);

              if (blobEndpoint && sas) {
                baseUrl = blobEndpoint.endsWith("/")
                  ? blobEndpoint
                  : `${blobEndpoint}/`;
                sasToken = sas.startsWith("?") ? sas : `?${sas}`;
              }
            } else {
              // Assume it is a direct SAS URL
              const sasUrlObj = new URL(decodeURIComponent(sasUrl));
              baseUrl = sasUrlObj.origin + sasUrlObj.pathname;
              sasToken = sasUrlObj.search;
            }

            if (!baseUrl) {
              throw new Error(
                "Could not determine Blob base URL from connection string."
              );
            }

            // Create the full blob URL with SAS token for the new blob
            const blobSasUrl = `${baseUrl}${blobContainerName}/${blobName}${sasToken}`;

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
            const publicBlobUrl = `${sasUrlObj.origin}${containerName}/${blobName}`;
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

  // Table creation is now handled by Drizzle migrations or push, so this is not needed

  async saveMenuItem(item: MenuItem): Promise<MenuItem | null> {
    try {
      const { items, etag } = await this.loadMenu();
      if (items.some((x) => x.name === item.name)) return null;

      const next = [...items, item];
      const res = await writeMenuToBlob({ items: next, ifMatch: etag });
      this.setCache(next, res.etag);
      return item;
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
    try {
      const { items } = await this.loadMenu();
      // Preserve existing behavior: newest first (date is dd/mm/yyyy).
      return [...items].sort((a, b) => {
        const [ad, am, ay] = a.date.split("/").map(Number);
        const [bd, bm, by] = b.date.split("/").map(Number);
        const aTime = Date.UTC(ay || 0, (am || 1) - 1, ad || 1);
        const bTime = Date.UTC(by || 0, (bm || 1) - 1, bd || 1);
        return bTime - aTime;
      });
    } catch (error) {
      console.error("Error fetching menu items:", error);
      return [];
    }
  }

  async remakeAllImages(): Promise<{
    success: boolean;
    updated: number;
    errors: number;
  }> {
    console.log("Starting image regeneration for all menu items...");
    let updated = 0;
    let errors = 0;

    try {
      // Get all menu items
      const { items: allItems, etag } = await this.loadMenu(true);
      console.log(`Found ${allItems.length} items to regenerate images for`);

      // Regenerate image for each item
      for (const item of allItems) {
        try {
          console.log(`Regenerating image for: ${item.name}`);
          const newImageUrl = await this.makeImage(item);

          // Update in blob storage
          const updatedItems = allItems.map((x) =>
            x.name === item.name ? { ...x, imageurl: newImageUrl } : x
          );
          const res = await writeMenuToBlob({
            items: updatedItems,
            ifMatch: etag,
          });
          this.setCache(updatedItems, res.etag);

          updated++;
          console.log(`✓ Updated image for: ${item.name}`);

          // Add a small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`Error regenerating image for ${item.name}:`, error);
          errors++;
        }
      }

      console.log(
        `Image regeneration complete. Updated: ${updated}, Errors: ${errors}`
      );
      return { success: true, updated, errors };
    } catch (error) {
      console.error("Error in remakeAllImages:", error);
      return { success: false, updated, errors };
    }
  }

  async close(): Promise<void> {
    // no-op
  }
}

// Singleton accessor to avoid multiple interval schedulers and DB clients
declare global {
  // eslint-disable-next-line no-var
  var __menuServiceSingleton: MenuService | undefined;
}

export function getMenuService(): MenuService {
  if (!globalThis.__menuServiceSingleton) {
    globalThis.__menuServiceSingleton = new MenuService();
  }
  return globalThis.__menuServiceSingleton;
}
