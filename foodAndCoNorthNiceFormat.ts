import { BlobServiceClient } from "npm:@azure/storage-blob@12.16.0";
import { encode as base64Encode } from "https://deno.land/std@0.192.0/encoding/base64.ts";
import { Buffer } from "node:buffer";

const FOOD_AND_CO_API_URL = "https://www.shop.foodandco.dk/api/WeeklyMenu?restaurantId=1073&languageCode=da-DK&date=";
const OPENAI_API_URL = "https://api.openai.com/v1/images/generations";

interface Dish {
  type: string;
  name: string;
  picUrl?: string;
}

interface DayMenu {
  day: string;
  dishes: Dish[];
}

function getWeekNumber(): [number, number] {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return [d.getUTCFullYear(), weekNo];
}

function isPastDate(day: string): boolean {
  const [dayNum, monthName] = day.match(/(\d+)\. (\w+)/)?.slice(1) || [];
  const currentDate = new Date();
  const dayDate = new Date(`${monthName} ${dayNum}, ${currentDate.getFullYear()} 12:00:00`);

  if (dayDate.toDateString() === currentDate.toDateString()) {
    return currentDate.getHours() >= 12;
  }

  return dayDate < currentDate;
}

async function getDataFromFoodAndCoWebPage(): Promise<DayMenu[]> {
  const formattedDate = new Date().toISOString().split("T")[0];
  const response = await fetch(`${FOOD_AND_CO_API_URL}${formattedDate}`);
  const data = await response.json();
  const daysMenu: DayMenu[] = data.days.map((day: any) => ({
    day: `${day.dayOfWeek}\nd.\n${new Date(day.date).getDate()}. ${new Date(day.date).toLocaleString("da-DK", { month: "long" })}`,
    dishes: day.menus.map((menu: any) => ({ type: menu.type, name: menu.menu })),
  }));
  return daysMenu;
}

async function uploadToBlobStorage(content: string, blobName: string, containerName = "weekly-food-menu"): Promise<void> {
  const blobServiceClient = new BlobServiceClient(Deno.env.get("AZURE_STORAGE_CONNECTION_STRING") || "");
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.upload(content, content.length);
}

async function getDataFromBlobStorage(blobName: string): Promise<DayMenu[] | null> {
    const connectionString = Deno.env.get("AZURE_STORAGE_CONNECTION_STRING");
    if(!connectionString) {
        throw new Error("AZURE_STORAGE_CONNECTION_STRING is not set");
    }   
  const blobServiceClient = new BlobServiceClient(connectionString);
  const containerClient = blobServiceClient.getContainerClient("weekly-food-menu");
  const blobClient = containerClient.getBlobClient(blobName);
  try {
    const downloadResponse = await blobClient.download(0);
    if (!downloadResponse.readableStreamBody) {
      return null;
    }
    const chunks: (string | Buffer)[] = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(chunk);
    }
    let jsonString: string;
    if (typeof chunks[0] === 'string') {
      jsonString = chunks.join('');
    } else {
      jsonString = new TextDecoder().decode(Buffer.concat(chunks as Buffer[]));
    }
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

async function createImageFromPrompt(prompt: string, blobName: string, model = "dall-e-3"): Promise<string> {
  const imageSize = model === "dall-e-3" ? "1024x1024" : "512x512";
  let response;
  try {
    response = await fetch(OPENAI_API_URL, {
        method: "POST",
        body: JSON.stringify({ model, prompt, n: 1, size: imageSize, response_format: "b64_json" }),
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        }
    });
  } catch (error) {
    if (error.response?.status === 429) {
      console.log("Retrying after 1 min", { prompt, blobName });
      await new Promise((resolve) => setTimeout(resolve, 61000));
      return createImageFromPrompt(prompt, blobName);
    }
    throw error;
  }
  const data = await response.json();
  const base64 = data[0].b64_json;
  return uploadBase64ImageToBlobStorage(base64, blobName);
}

async function uploadBase64ImageToBlobStorage(base64: string, blobName: string, containerName = "food-images"): Promise<string> {
  const buffer = base64Encode(base64);
  const blobServiceClient = new BlobServiceClient(Deno.env.get("AZURE_STORAGE_CONNECTION_STRING") || "");
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.upload(buffer, buffer.length, {
    blobHTTPHeaders: { blobContentType: "image/png" },
  });
  return blockBlobClient.url;
}

async function processMenuWithPics(daysMenu: DayMenu[]): Promise<DayMenu[]> {
  const daysMenuWithPics = await Promise.all(
    daysMenu.map(async (day, dayIndex) => {
      const dishesWithPics = await Promise.all(
        day.dishes.map(async (dish, dishIndex) => {
          const prompt = dish.name === "." ? "Nice weekend for a programmer" : dish.name;
          const picUrl = await createImageFromPrompt(prompt, `${dayIndex}-${dishIndex}.png`);
          return { ...dish, picUrl };
        })
      );
      return { ...day, dishes: dishesWithPics };
    })
  );
  return daysMenuWithPics;
}

export async function foodAndCoNorthNiceFormat(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const [year, week] = getWeekNumber();
    const blobName = `menu-${year}-${week}.json`;
    let menuData = await getDataFromBlobStorage(blobName);
    if (!menuData) {
      menuData = await getDataFromFoodAndCoWebPage();
      menuData = await processMenuWithPics(menuData);
      await uploadToBlobStorage(JSON.stringify(menuData), blobName);
    }
    const htmlTemplate = await Deno.readTextFile("./food_and_co_template.html");
    
    const menuHtml = htmlTemplate.replace("{{MENU_CONTENT}}", generateMenuHtml(menuData));
    
    return new Response(menuHtml, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("Error occurred while processing the menu:", error);
    return new Response("Error occurred while processing the menu.", { status: 500 });
  }
}

function generateMenuHtml(daysMenu: DayMenu[]): string {
  return daysMenu
    .map(
      (day, index) => `
    <div class="day-container ${isPastDate(day.day) ? "minimized" : ""}" id="day-${index}">
      <h2 class="day" onclick="toggleDay('day-${index}')">${day.day}</h2>
      <ul class="dishes">
        ${day.dishes
          .map(
            (dish) => `
          <li class="dish">
            <div class="dish-info"><strong>${dish.type}</strong>: ${dish.name}</div>
            ${dish.picUrl ? `<div class="dish-image"><img src="${dish.picUrl}" alt="${dish.name}"></div>` : ""}
          </li>
        `
          )
          .join("")}
      </ul>
    </div>
  `
    )
    .join("");
}