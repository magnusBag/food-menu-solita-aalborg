
interface Dish {
  type: string;
  name: string;
}

interface DayMenu {
  day: string;
  dishes: Dish[];
}

export async function foodAndCoNorth(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const date = new Date();
    const formattedDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    const url = `https://www.shop.foodandco.dk/api/WeeklyMenu?restaurantId=1073&languageCode=da-DK&date=${formattedDate}`;

    const response = await fetch(url);
    const data = await response.json();
    const daysMenu: DayMenu[] = data.days.map((day: any) => {
      return {
        day: `${day.dayOfWeek}\nd.\n${new Date(day.date).getDate()}. ${new Date(day.date).toLocaleString('da-DK', { month: 'long' })}`,
        dishes: day.menus.map((menu:any) => ({
          type: menu.type,
          name: menu.menu,
        })),
      };
    });

    return new Response(JSON.stringify(daysMenu), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error occurred while scrapinsg the menu:", error);
    return new Response("Error occurred while scraping the menu.", { status: 500 });
  }
}