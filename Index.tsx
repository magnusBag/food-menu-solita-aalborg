import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { MenuService } from './src/MenuService';

const menuService = new MenuService();

function getWeek(date:Date) {
  if (!(date instanceof Date)) date = new Date();

  // ISO week date weeks start on Monday, so correct the day number
  var nDay = (date.getDay() + 6) % 7;

  // ISO 8601 states that week 1 is the week with the first Thursday of that year
  // Set the target date to the Thursday in the target week
  date.setDate(date.getDate() - nDay + 3);

  // Store the millisecond value of the target date
  var n1stThursday = date.valueOf();

  // Set the target to the first Thursday of the year
  // First, set the target to January 1st
  date.setMonth(0, 1);

  // Not a Thursday? Correct the date to the next Thursday
  if (date.getDay() !== 4) {
    date.setMonth(0, 1 + ((4 - date.getDay()) + 7) % 7);
  }

  // The week number is the number of weeks between the first Thursday of the year
  // and the Thursday in the target week (604800000 = 7 * 24 * 3600 * 1000)
  return 1 + Math.ceil((n1stThursday - date.valueOf()) / 604800000);
}


const app = new Elysia()
  .use(staticPlugin())
  .use(staticPlugin({ assets: 'public', prefix: '' }))
  .get('/alive', () => {
    return {
      alive: true
    };
  })
    .get('/menu', async () => {
      const menu = await menuService.getAllMenuItems();
      // Filter out past menu items and group by work week
      const relevantMenuGroupedByWorkWeek = menu.filter(item => new Date(item.date) >= new Date());
      // Group by work week
      const groupedByWorkWeek: Record<string, any[]> = {};
      relevantMenuGroupedByWorkWeek.forEach(item => {
        const workWeek = getWeek(new Date(item.date));
        if (!groupedByWorkWeek[workWeek]) {
          groupedByWorkWeek[workWeek] = [];
        }
        groupedByWorkWeek[workWeek].push(item);
      });

      return Object.entries(groupedByWorkWeek).map(([weekNumber, items]) => ({
        weekNumber,
        items,
      }));
    })
    .listen(3000);

console.log(`🦊 Server is running at http://localhost:${app.server?.port}`);
