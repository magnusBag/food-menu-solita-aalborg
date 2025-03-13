import React from 'react';
import { MenuItem } from '../models/menu';

interface MenuProps {
  title: string;
  message: string;
  menuItems: MenuItem[];
}

export const Menu = ({ title, message, menuItems }: MenuProps) => {
  

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
  const processedMenuItems = React.useMemo(() => {
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
      formattedDate: string
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
          })
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
        <p className="message">{message}</p>
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
                {dateData.items.map((item) => {
                  const isUniqueDate = dateData.items.length === 1;
                  
                  return (
                    <div 
                      key={item.name}
                      className={`card ${isUniqueDate ? 'fullWidth' : ''}`}
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
                        <h3 className="cardTitle">{item.name.length > 0 ? item.name : item.description}</h3>
                        <p className="cardDescription">{item.description}</p>
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