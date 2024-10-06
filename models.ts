export interface WeeklyMenu {
    weekNumber: number;
    firstDateOfWeek: string;
    days: DayMenu[];
  }
  
  export interface Dish {
    type: string;
    name: string;
    picUrl?: string;
  }
  
  export interface DayMenu {
    day: string;
    dishes: Dish[];
  }