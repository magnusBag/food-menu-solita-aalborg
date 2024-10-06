import { BlobServiceClient } from "npm:@azure/storage-blob@12.16.0";
import { Buffer } from "node:buffer";
import { DayMenu } from "./models.ts";
import { getNextWeekMenu } from "./services/getNextWeekMenu.ts";

const FOOD_AND_CO_API_URL =
    "https://www.shop.foodandco.dk/api/WeeklyMenu?restaurantId=1073&languageCode=da-DK&date=";
const OPENAI_API_URL = "https://api.openai.com/v1/images/generations";

function getWeekNumber(): [number, number] {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(
        ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    );
    return [d.getUTCFullYear(), weekNo];
}

function isPastDate(day: string): boolean {
    const [dayNum, monthName] = day.match(/(\d+)\. (\w+)/)?.slice(1) || [];
    const currentDate = new Date();
    const dayDate = new Date(
        `${monthName} ${dayNum}, ${currentDate.getFullYear()} 12:00:00`,
    );

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
        day: `${day.dayOfWeek}\nd.\n${new Date(day.date).getDate()}. ${
            new Date(day.date).toLocaleString("da-DK", { month: "long" })
        }`,
        dishes: day.menus.map((menu: any) => ({
            type: menu.type,
            name: menu.menu,
        })),
    }));
    return daysMenu;
}

async function uploadToBlobStorage(
    content: string,
    blobName: string,
    containerName = "weekly-food-menu",
): Promise<void> {
    const blobServiceClient = new BlobServiceClient(
        Deno.env.get("AZURE_STORAGE_CONNECTION_STRING") || "",
    );
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.upload(content, content.length);
}

async function getDataFromBlobStorage(
    blobName: string,
): Promise<DayMenu[] | null> {
    const connectionString = Deno.env.get("AZURE_STORAGE_CONNECTION_STRING");
    if (!connectionString) {
        throw new Error("AZURE_STORAGE_CONNECTION_STRING is not set");
    }
    const blobServiceClient = new BlobServiceClient(connectionString);
    const containerClient = blobServiceClient.getContainerClient(
        "weekly-food-menu",
    );
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
        if (typeof chunks[0] === "string") {
            jsonString = chunks.join("");
        } else {
            jsonString = new TextDecoder().decode(
                Buffer.concat(chunks as Buffer[]),
            );
        }
        return JSON.parse(jsonString);
    } catch {
        return null;
    }
}

async function createImageFromPrompt(
    prompt: string,
    FileHint: string,
): Promise<string> {
    let response;
    try {
        response = await fetch(OPENAI_API_URL, {
            method: "POST",
            body: JSON.stringify({
                model: "dall-e-3",
                prompt,
                n: 1,
                size: "1024x1024",
                response_format: "b64_json",
            }),
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
            },
        });

        if (!response.ok && response.status === 429) {
            console.log("Retrying after 1 min", { prompt, FileHint });
            await new Promise((resolve) => setTimeout(resolve, 61000));
            return createImageFromPrompt(prompt, FileHint);
        }

        const data = await response.json();

        if (!data.data || !data.data[0] || !data.data[0].b64_json) {
            console.error("Unexpected response format from OpenAI API:", data);
            return "";
        }

        const base64 = data.data[0].b64_json;
        return "data:image/png;base64, " + base64;
    } catch (error) {
        console.error("Error in createImageFromPrompt:", error);
        return "";
    }
}

async function processMenuWithPics(
    daysMenu: DayMenu[],
    FileHint: string,
): Promise<DayMenu[]> {
    const daysMenuWithPics = await Promise.all(
        daysMenu.map(async (day, dayIndex) => {
            const dishesWithPics = await Promise.all(
                day.dishes.map(async (dish, dishIndex) => {
                    const prompt = dish.name === "."
                        ? "Nice weekend for a programmer"
                        : dish.name;
                    const picUrl = await createImageFromPrompt(
                        prompt,
                        `${FileHint} - ${dayIndex}-${dishIndex}.png`,
                    );
                    return {
                        ...dish,
                        picUrl,
                    };
                }),
            );
            return { ...day, dishes: dishesWithPics };
        }),
    );
    return daysMenuWithPics;
}

export async function foodAndCoNorthNiceFormat(): Promise<Response> {
    try {
        const [year, week] = getWeekNumber();
        const blobName = `menu-${year}-${week}.json`;
        let menuData = await getDataFromBlobStorage(blobName);
        if (!menuData) {
            menuData = await getDataFromFoodAndCoWebPage();
            menuData = await processMenuWithPics(menuData, blobName);
            await uploadToBlobStorage(
                JSON.stringify(menuData),
                blobName,
            );
        }

        const nextWeekBlobName = `menu-${year}-${week + 1}.json`;

        let nextWeekMenu = await getDataFromBlobStorage(nextWeekBlobName);
        if (!nextWeekMenu) {
            nextWeekMenu = await getNextWeekMenu();
            nextWeekMenu = await processMenuWithPics(
                nextWeekMenu,
                nextWeekBlobName,
            );

            await uploadToBlobStorage(
                JSON.stringify(nextWeekMenu),
                nextWeekBlobName,
            );
        }

        const htmlTemplate = await Deno.readTextFile(
            "./food_and_co_template.html",
        );

        let menuHtml = htmlTemplate.replace(
            "{{MENU_CONTENT}}",
            generateMenuHtml(menuData),
        );
        menuHtml = menuHtml.replace(
            "{{NEXT_WEEK_MENU_CONTENT}}",
            generateMenuHtml(nextWeekMenu, menuData.length),
        );

        return new Response(menuHtml, {
            headers: { "Content-Type": "text/html" },
        });
    } catch (error) {
        console.error("Error occurred while processing the menu:", error);
        return new Response("Error occurred while processing the menu.", {
            status: 500,
        });
    }
}

function formatDate(date: string): string {
    const d = new Date(date);
    return `${d.getDate()}. ${d.toLocaleString("da-DK", { month: "long" })}`;
}

function generateMenuHtml(daysMenu: DayMenu[], startIndex = 0): string {
    return daysMenu
        .map(
            (day, index) => `
    <div class="day-container ${
                isPastDate(day.day) ? "minimized" : ""
            }" id="day-${startIndex + index}">
      <h2 class="day" onclick="toggleDay('day-${startIndex + index}')">${
                formatDate(day.day)
            }</h2>
      <ul class="dishes">
        ${
                day.dishes
                    .map(
                        (dish) => `
          <li class="dish">
            <div class="dish-info"><strong>${dish.type}</strong>: ${dish.name}</div>
            ${
                            dish.picUrl
                                ? `<div class="dish-image"><img src="${dish.picUrl}" alt="${dish.name}"></div>`
                                : ""
                        }
          </li>
        `,
                    )
                    .join("")
            }
      </ul>
    </div>
  `,
        )
        .join("");
}
