import { DayMenu } from "./util/models.ts";
import {
    getDataFromBlobStorage,
    uploadToBlobStorage,
} from "./util/azureBlob.ts";
import { formatDate, getWeekNumber, isPastDate } from "./util/dateUtil.ts";
import { getWeekMenu } from "./util/getMenuData.ts";
import { createImageFromPrompt } from "./util/OpenAI.ts";
import { translateToEnglish } from "./util/OpenAI.ts";

export async function foodAndCoMenuParser(
    returnType: "html" | "json" = "html",
): Promise<Response> {
    try {
        const [year, week] = getWeekNumber();
        const thisWeekMenu = await processWeekMenu(year, week, false);
        const nextWeekMenu = await processWeekMenu(year, week, true);
        console.log(nextWeekMenu);

        const htmlTemplate = await Deno.readTextFile(
            "./food_and_co_template.html",
        );
        const menuHtml = generateFullMenuHtml(
            htmlTemplate,
            thisWeekMenu,
            nextWeekMenu,
        );
        if (returnType === "json") {
            const bothWeeksMenu = {
                thisWeekMenu,
                nextWeekMenu,
            };
            return new Response(JSON.stringify(bothWeeksMenu), {
                headers: { "Content-Type": "application/json" },
            });
        }
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

async function processWeekMenu(
    year: number,
    week: number,
    isNextWeek: boolean,
): Promise<DayMenu[]> {
    const blobName = `menu-${year}-${isNextWeek ? week + 1 : week}.json`;

    const menuData = await getDataFromBlobStorage(blobName);

    if (menuData && menuData.length > 0) return menuData;

    const newFoodData = await getWeekMenu(isNextWeek ? "next" : "now");
    const newFoodDataTranslated = await translateMenu(newFoodData);
    const newFoodDataWithPics = await addImagesToWeek(newFoodDataTranslated);

    await uploadToBlobStorage(newFoodDataWithPics, blobName);

    return newFoodDataWithPics;
}

function generateFullMenuHtml(
    template: string,
    thisWeekMenu: DayMenu[],
    nextWeekMenu: DayMenu[],
): string {
    let menuHtml = template.replace(
        "{{MENU_CONTENT}}",
        generateMenuHtml(thisWeekMenu),
    );
    menuHtml = menuHtml.replace(
        "{{NEXT_WEEK_MENU_CONTENT}}",
        generateMenuHtml(nextWeekMenu, thisWeekMenu.length),
    );
    return menuHtml;
}

export async function addImagesToWeek(
    daysMenu: DayMenu[],
): Promise<DayMenu[]> {
    const updatedMenu: DayMenu[] = [];

    for (const [dayIndex, day] of daysMenu.entries()) {
        const updatedDishes = await Promise.all(
            day.dishes.map(async (dish, dishIndex) => {
                const picUrl = await createImageFromPrompt(
                    dish.nameEn ?? dish.name,
                    `${dayIndex}-${dishIndex}.png`,
                );
                return { ...dish, picUrl };
            }),
        );

        updatedMenu.push({ ...day, dishes: updatedDishes });
    }

    return updatedMenu;
}

async function translateMenu(daysMenu: DayMenu[]): Promise<DayMenu[]> {
    const translatedMenu = await Promise.all(
        daysMenu.map(async (day) => {
            const translatedDishes = await Promise.all(
                day.dishes.map(async (dish) => {
                    return {
                        ...dish,
                        nameEn: await translateToEnglish(dish.name),
                    };
                }),
            );
            return { ...day, dishes: translatedDishes };
        }),
    );
    return translatedMenu;
}

export function generateMenuHtml(daysMenu: DayMenu[], startIndex = 0): string {
    if (!daysMenu.length) {
        return `<div class="no-menu" data-en="Menu will be here soon..." data-da="Menu kommer snart...">Menu kommer snart...</div>`;
    }
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
            <div class="dish-info" data-name="${dish.name}" data-name-en="${
                            dish.nameEn || dish.name
                        }"><strong>${dish.type}</strong>: ${dish.name}</div>
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
