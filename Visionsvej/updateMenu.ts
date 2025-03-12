import { foodAndCoMenuParser } from "./foodAndCoMenuParser.ts";

export async function updateMenu() {
    const menu = await foodAndCoMenuParser();
    console.log(menu);
}

updateMenu();
