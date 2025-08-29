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

    for (const { api, targetList } of bots) {
        // console.log(await api.getAllGroups());
        // console.log(await api.getGroupInfo("2532685792790035945"))
        // api.listener.on("message", (message) => {
        //     handleMessage(api, targetList, message);
        // });
        // api.listener.start();

        api.listener.on("message", (message) => {
            handleMessage(api, targetList, message);
        });

        api.listener.start();
    }

    console.log("✅ Tất cả bot đã được khởi động.");
})();
