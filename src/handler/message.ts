import fs from "fs";
import path from "path";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { TargetMap } from "../types";
import { API, ThreadType } from "zca-js";
import mime from "mime-types";
import { promisify } from "util";
const unlinkAsync = promisify(fs.unlink);

export async function handleMessage(
    api: API,
    targetList: TargetMap,
    message: any
) {
    const { content, msgType, uidFrom, dName } = message.data;
    let threadId = message.threadId;
    const threadType = message.type;

    console.log(content, msgType, uidFrom, dName, threadId, threadType)

    const target = targetList[threadId];

    if (!target) return;

    if (target.from !== "" && target.from !== uidFrom) {
        console.log(`❌ Bỏ qua tin nhắn từ ${dName} (${uidFrom} do target là ${target.from})`);
        return;
    }

    for (const targetId of target.to) {
        if (msgType === "webchat") {
            api.sendMessage(content, targetId, threadType);
        } else if (msgType === "chat.photo" && content.href) {
            await sendImage(api, content.href, targetId, threadType);
        }
    }
}

async function sendImage(api: API, url: string, threadId: string, threadType: ThreadType) {
  const uploadDir = path.resolve("upload");
  fs.mkdirSync(uploadDir, { recursive: true });

  // 1) Tải ảnh an toàn
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 15000,
    // Một số CDN cần UA hoặc Referrer, bật nếu cần:
    headers: {
      "User-Agent": "Mozilla/5.0",
      // "Referer": "https://your-app.example", // nếu server yêu cầu
      // "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
    },
    // Chặn 30x lạ -> axios tự follow redirect; vẫn nên validate status thủ công
    validateStatus: (s) => s >= 200 && s < 400,
  });

  const ctype = (res.headers["content-type"] || "").split(";")[0].trim();
  if (!ctype.startsWith("image/")) {
    throw new Error(`URL không trả về ảnh. content-type: ${ctype || "unknown"}`);
  }

  const buffer = Buffer.from(res.data);
  if (!buffer.length) {
    throw new Error("Ảnh tải về rỗng (0 bytes).");
  }

  // 2) Đặt phần mở rộng theo MIME
  const ext = mime.extension(ctype) || "jpg";
  const fileName = `${uuidv4()}.${ext}`;
  const filePath = path.join(uploadDir, fileName);

  fs.writeFileSync(filePath, buffer); // đảm bảo ghi Buffer chứ không phải ArrayBuffer

  try {
    // 3) Gửi và dọn dẹp
    await api.sendMessage(
      {
        msg: "",
        attachments: [filePath],
      },
      threadId,
      threadType
    );
  } finally {
    // xóa file tạm (không chờ)
    unlinkAsync(filePath).catch((err) => console.error("Lỗi xóa ảnh:", err.message));
  }
}
