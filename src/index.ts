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
        const groups = await api.getAllGroups();

        let result = [];
        for (const groupId of Object.keys(groups.gridVerMap)) {
            const groupData = await api.getGroupInfo(groupId);

            // lấy ra phần gridInfoMap (có thể chứa nhiều nhóm, nhưng thường là 1)
            const infos = Object.values(groupData.gridInfoMap);
            for (const info of infos) {
                result.push({
                    id: info.groupId,
                    name: info.name
                });
            }
        }

        console.log(result);
    }

    



    // for (const { api, targetList } of bots) {
    //     api.listener.on("message", (message) => {
    //         handleMessage(api, targetList, message);
    //     });
    //     api.listener.start();
    // }

    console.log("✅ Tất cả bot đã được khởi động.");
})();
