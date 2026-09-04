import { google } from "googleapis";
import mammoth from "mammoth";
import type { Env } from "../config.js";
import { logger } from "../lib/logger.js";

export interface InternalDoc {
  name: string;
  text: string;
}

/**
 * 共有Googleドライブの指定フォルダ（読み取り専用サービスアカウント経由）を毎回スキャンし、
 * Googleドキュメント／スプレッドシート／スライドのテキストを抽出する。
 * GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_DRIVE_FOLDER_ID が未設定の場合は空配列を返す（社内資料連携は任意機能）。
 */
export async function fetchInternalDocs(env: Env): Promise<InternalDoc[]> {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON || !env.GOOGLE_DRIVE_FOLDER_ID) {
    logger.info("Googleドライブ連携が未設定のためスキップします");
    return [];
  }

  const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  const drive = google.drive({ version: "v3", auth });

  const list = await drive.files.list({
    q: `'${env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false`,
    fields: "files(id, name, mimeType)",
    pageSize: 50,
  });

  const files = list.data.files ?? [];
  const docs: InternalDoc[] = [];

  for (const file of files) {
    if (!file.id || !file.name) continue;
    try {
      if (file.mimeType === "application/vnd.google-apps.document") {
        const exported = await drive.files.export(
          { fileId: file.id, mimeType: "text/plain" },
          { responseType: "text" }
        );
        docs.push({ name: file.name, text: String(exported.data) });
      } else if (
        file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const downloaded = await drive.files.get(
          { fileId: file.id, alt: "media" },
          { responseType: "arraybuffer" }
        );
        const { value: text } = await mammoth.extractRawText({
          buffer: Buffer.from(downloaded.data as ArrayBuffer),
        });
        docs.push({ name: file.name, text });
      } else if (file.mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
        // PowerPoint(.pptx)のテキスト抽出は未実装（スライドXMLの解析が必要なため対応保留）。
        // 導入時に資料形式がpptx中心であれば専用パーサーの追加を検討する。
        logger.warn("PowerPoint(.pptx)のテキスト抽出は未実装です", { name: file.name });
      }
    } catch (err) {
      logger.warn("社内資料の取得に失敗しました", {
        name: file.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return docs;
}
