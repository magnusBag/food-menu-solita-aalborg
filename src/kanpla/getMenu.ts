import { MenuItem } from "../models/menuItem";

export const getMenu = async () => {
  console.log("Getting token...");
  const token = await getToken();
  console.log("Token obtained, fetching menu data...");

  const res = await fetch("https://app.kanpla.dk/api/internal/load/frontend", {
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "en,da;q=0.9,en-US;q=0.8",
      authorization: "Bearer " + token,
      "content-type": "application/json",
      "kanpla-app-env": "PROD",
      "kanpla-auth-provider": "GAuth",
      "kanpla-debug": "true",
      priority: "u=1, i",
      "sec-ch-ua":
        '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      cookie:
        "_clck=1d41hat%7C2%7Cfu5%7C0%7C1897; _reb2buid=42cf4559-ecf5-4f1a-8129-31de674faea4-1741811331038; _reb2bsessionID=MGEImNIS6numvpayVQYPgR1z; _reb2bgeo=%7B%22city%22%3A%22Aalborg%22%2C%22country%22%3A%22Denmark%22%2C%22countryCode%22%3A%22DK%22%2C%22hosting%22%3Afalse%2C%22isp%22%3A%22STOFA%22%2C%22lat%22%3A57.0421%2C%22proxy%22%3Afalse%2C%22region%22%3A%2281%22%2C%22regionName%22%3A%22North%20Denmark%22%2C%22status%22%3A%22success%22%2C%22timezone%22%3A%22Europe%2FCopenhagen%22%2C%22zip%22%3A%229000%22%7D; _reb2bref=https://app.kanpla.dk/; intercom-device-id-x182n37a=fc792837-f721-4b72-a8f0-ebdcfd4f44e7; _clsk=1wg6yux%7C1741811601103%7C3%7C1%7Cv.clarity.ms%2Fcollect; intercom-session-x182n37a=Z2FaZGlzUU1wQzQwV0NLQ2dMY0hER01GRU40djRrOXpzOFozY2tVcllDOXRRYzBRUDBRNTM3T2RTWEZKR29xSW4yQ3N5UU05UDlqa2prT3l6YTFSdytSbmxJQjMyZXprdERRL1VUOU9MOTA9LS1iaHRVRzNZN1FidHdXQmZDZ3hZTUx3PT0=--e9c4dcdc68dc0f7ba338a8682e4acd73dd5d7ec4; _reb2bloaded=true",
      Referer: "https://app.kanpla.dk/app",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
    body: '{"userId":"4ezDF512rFYWC8qtTNUg4OpVe8Q2","url":"app","_reloader":0,"language":"en","path":"load/frontend"}',
    method: "POST",
  });

  const data = await res.json();
  console.log("API response received, processing menu data...");
  // look for the menu items under the dates list, "offers" -> "inPjWPmEozlHYlIJEiep" -> "items" -> "dates"
  const meatDates = data.offers.inPjWPmEozlHYlIJEiep.items[0].dates;
  const veggieDates = data.offers.inPjWPmEozlHYlIJEiep.items[1].dates;
  // Then turn the dict into an array
  const meatDishes = Object.values(meatDates)
    .filter((x: any) => x.menu)
    .map((x: any) => ({ ...x.menu, type: "meat" }));
  const veggieDishes = Object.values(veggieDates)
    .filter((x: any) => x.menu)
    .map((x: any) => ({ ...x.menu, type: "veggie" }));

  const menu: MenuItem[] = [...meatDishes, ...veggieDishes];

  // sort by date
  menu.sort((a, b) => a.dateSeconds - b.dateSeconds);

  // format date
  menu.forEach((x: MenuItem) => {
    // Use UTC to avoid timezone issues
    const date = new Date(x.dateSeconds * 1000);
    const utcDate = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );

    // Format as dd/mm/yyyy (Danish format)
    const day = utcDate.getUTCDate().toString().padStart(2, "0");
    const month = (utcDate.getUTCMonth() + 1).toString().padStart(2, "0");
    const year = utcDate.getUTCFullYear();
    x.date = `${day}/${month}/${year}`;

    if (x.name.length == 0) x.name = x.description;
  });

  return menu;
};

const getToken = async () => {
  const res = await fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyDDtuovWpK6PARKIt9wUqaTQP7MjFWIWF4",
    {
      headers: {
        accept: "*/*",
        "accept-language": "en,da;q=0.9,en-US;q=0.8",
        "content-type": "application/json",

        priority: "u=1, i",
        "sec-ch-ua":
          '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        "x-client-data":
          "CIW2yQEIpLbJAQipncoBCN/3ygEIkqHLAQj+ossBCJv+zAEIhqDNAQjJ4c4BGI/OzQE=",
        "x-client-version": "Chrome/JsCore/10.11.1/FirebaseCore-web",
        "x-firebase-gmpid": "1:19720024142:web:a836d7024ea764929dd31f",
      },
      referrerPolicy: "no-referrer",
      body: '{"returnSecureToken":true,"email":"mba@solita.dk","password":"Solita1234","clientType":"CLIENT_TYPE_WEB"}',
      method: "POST",
    }
  );

  const data = await res.json();
  return data.idToken;
};
