import accounts from "./config/accounts.js";
import { createZaloBot } from "./lib/zalo.js";
import { handleMessage } from "./handler/message.js";

(async () => {
    const bots = await Promise.all(
        accounts.map(async (config) => {
            const { api, targetList, name } = await createZaloBot(config);
            console.log(`🤖 Bot "${name}" đã khởi tạo.`);
            return { api, targetList };
        })
    );

    bots.forEach(({ api, targetList }) => {
        api.listener.on("message", (message) => {
            handleMessage(api, targetList, message);
        });

        api.listener.start();
    });

    console.log("✅ Tất cả bot đã được khởi động.");
})();
