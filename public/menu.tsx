import React, { useMemo } from 'react';
import { MenuItem } from '../models/menu';
import './menu.css';

interface MenuProps {
  title: string;
  menuItems: MenuItem[];

}

function getWeekNumber(date: Date): number {
  // Create a copy of the date to avoid modifying the original
  const d = new Date(date.getTime());

  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));

  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));

  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  return weekNo;
}

export const Menu = ({ title, menuItems }: MenuProps) => {
  // Function to check if a date is in the past
  const isPastDate = (dateString: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of day for accurate comparison
    const itemDate = new Date(dateString);
    itemDate.setHours(0, 0, 0, 0);
    return itemDate < today;
  };

  // Function to check if a date is today
  const isToday = (dateString: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const itemDate = new Date(dateString);
    itemDate.setHours(0, 0, 0, 0);
    return itemDate.getTime() === today.getTime();
  };

  // Function to get day of week in Danish
  const getDanishDayOfWeek = (dateString: string) => {
    const date = new Date(dateString);
    const danishDays = [
      'Søndag', 'Mandag', 'Tirsdag', 'Onsdag',
      'Torsdag', 'Fredag', 'Lørdag'
    ];
    return danishDays[date.getDay()];
  };

  // Pre-process and sort menu items by date (do this work once)
  const processedMenuItems = useMemo(() => {
    // Sort menu items by date
    const sortedItems = [...menuItems].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Group menu items by date
    const itemsByDate: Record<string, {
      items: MenuItem[],
      isPast: boolean,
      isCurrentDay: boolean,
      danishDay: string,
      formattedDate: string,
    }> = {};

    sortedItems.forEach(item => {
      const dateKey = item.date;

      if (!itemsByDate[dateKey]) {
        itemsByDate[dateKey] = {
          items: [],
          isPast: isPastDate(dateKey),
          isCurrentDay: isToday(dateKey),
          danishDay: getDanishDayOfWeek(dateKey),
          formattedDate: new Date(dateKey).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }),
        };
      }

      itemsByDate[dateKey].items.push(item);

    });

    return itemsByDate;
  }, [menuItems]);

  return (
    <div className="container">
      <header className="menuHeader">
        <h1 className="title">Menu</h1>
        <a href="/game" className="game-link">🎮 Play Food Matching Game</a>
      </header>

      <div className="menuContent">
        {Object.entries(processedMenuItems).map(([date, dateData]) => {
          // Skip rendering past dates completely to improve performance
          if (dateData.isPast) return null;

          return (
            <div key={date} className={`dateGroup ${dateData.isCurrentDay ? 'currentDay' : ''}`}>
              <div className="dayHeader">
                <h2 className="dayName">
                  {dateData.danishDay}
                  <span className="dateLabel">{dateData.formattedDate}</span>
                  {dateData.isCurrentDay && <span className="todayLabel">I dag</span>}
                </h2>
              </div>

              <div className="grid">
                {dateData.items.sort((a) => a.type === 'meat' ? -1 : 1).map((item) => {
                  const isUniqueDate = dateData.items.length === 1;

                  return (
                    <div
                      key={item.name}
                      className={`card ${isUniqueDate ? 'fullWidth' : ''} ${item.type === 'meat' ? 'meatDay' : 'veggieDay'}`}
                    >
                      <div className="cardImageContainer">
                        <img
                          src={item.imageurl}
                          alt={item.name || item.description}
                          className="cardImage"
                          loading="lazy"
                          width="768"
                          height="574"
                          decoding="async"
                          />
                        <span className={`itemType ${item.type}`}>{item.type}</span>
                      </div>

                      <div className="cardContent">
                        <h3 className="cardTitle">{item.name}</h3>
                        <p className="cardDescription">{item.description == item.name ? "" : item.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
