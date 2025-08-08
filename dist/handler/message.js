import fs from "fs";
import path from "path";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
export async function handleMessage(api, targetList, message) {
    const { content, msgType, uidFrom, dName } = message.data;
    let threadId = message.threadId;
    const threadType = message.type;
    console.log(content, msgType, uidFrom, dName, threadId, threadType);
    const target = targetList[threadId];
    if (!target || (target.from && target.from !== uidFrom)) {
        console.log(`❌ Bỏ qua tin nhắn từ ${dName} (${uidFrom} do target là ${target.from})`);
        return;
    }
    for (const targetId of target.to) {
        if (msgType === "webchat") {
            api.sendMessage(content, targetId, threadType);
        }
        else if (msgType === "chat.photo" && content.href) {
            await sendImage(api, content.href, targetId, threadType);
        }
    }
}
async function sendImage(api, url, threadId, threadType) {
    const fileName = `${uuidv4()}.jpg`;
    const uploadDir = path.resolve("upload");
    const filePath = path.join(uploadDir, fileName);
    fs.mkdirSync(uploadDir, { recursive: true });
    const response = await axios.get(url, { responseType: "arraybuffer" });
    fs.writeFileSync(filePath, response.data);
    await api.sendMessage({
        msg: "",
        attachments: [filePath],
    }, threadId, threadType);
    fs.unlink(filePath, (err) => {
        if (err)
            console.error("Lỗi xóa ảnh:", err.message);
    });
}
