import fs from "fs";
import path from "path";
import { Zalo } from "zca-js";
import { AccountConfig } from "../types";

export async function createZaloBot(config: AccountConfig) {
    const cookiePath = path.resolve("cookies", config.cookieFile);
    const cookie = JSON.parse(fs.readFileSync(cookiePath, "utf-8"));

    const zalo = new Zalo({
        selfListen: false,
        checkUpdate: true,
        logging: true,
    });

    const api = await zalo.login({
        cookie,
        imei: config.imei,
        userAgent: config.ua,
    });

    return { api, targetList: config.targetList, name: config.name };
}