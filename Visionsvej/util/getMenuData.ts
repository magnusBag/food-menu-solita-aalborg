import { DayMenu, Dish, WeeklyMenu } from "./models.ts";

const baseUrl = "https://www.shop.foodandco.dk/api/WeeklyMenu";

export async function getWeekMenu(
    when: "now" | "next",
    restaurantId: number = 1073,
    languageCode: string = "da-DK",
): Promise<DayMenu[]> {
    const date = when === "now"
        ? new Date().toISOString().split("T")[0]
        : getNextMonday();
    const url =
        `${baseUrl}?restaurantId=${restaurantId}&languageCode=${languageCode}&date=${date}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const res = await response.json();
    const weeklyMenu = mapToWeeklyMenu(res);
    return weeklyMenu.days;
}

export function mapToWeeklyMenu(apiResponse: any): WeeklyMenu {
    return {
        weekNumber: apiResponse.weekNumber,
        firstDateOfWeek: apiResponse.firstDateOfWeek,
        days: apiResponse.days.map(mapToDayMenu),
    };
}

export function mapToDayMenu(day: any): DayMenu {
    return {
        day: day.date,
        dishes: day.menus.map((menu: any): Dish => ({
            name: menu.menu,
            type: menu.type,
            picUrl: menu.image,
        })),
    };
}

function getNextMonday(): string {
    const today = new Date();
    const nextMonday = new Date(
        today.setDate(today.getDate() + ((7 - today.getDay() + 1) % 7 || 7)),
    );
    return nextMonday.toISOString().split("T")[0];
}
