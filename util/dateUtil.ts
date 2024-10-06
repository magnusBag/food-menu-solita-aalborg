export function getWeekNumber(): [number, number] {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(
        ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    );
    return [d.getUTCFullYear(), weekNo];
}

export function isPastDate(day: string): boolean {
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

export function formatDate(date: string): string {
    const d = new Date(date);
    return `${d.getDate()}. ${d.toLocaleString("da-DK", { month: "long" })}`;
}
