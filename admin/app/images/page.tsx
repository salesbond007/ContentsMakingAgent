"use client";

import { useEffect, useState } from "react";
import type { ImageEntry, ImageUseCase } from "@/lib/types";

const DRIVE_FOLDER_URL =
  "https://drive.google.com/drive/folders/1X0XVnsGNg6QewxbFTbYd8MFkaKmQnBvG?usp=sharing";

const USE_CASE_LABEL: Record<ImageUseCase, string> = {
  chart: "グラフ",
  seminar: "セミナー誘致",
  thumbnail: "通常記事のサムネ",
};

const USE_CASE_HELP: Record<ImageUseCase, string> = {
  chart: "本文中に挿入するグラフのデザイン参考として使う",
  seminar: "セミナー誘致用のCTAバナー等に使う",
  thumbnail: "記事のアイキャッチ画像を生成する際、このデザインに寄せて生成する",
};

export default function ImagesPage() {
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [useCase, setUseCase] = useState<ImageUseCase>("thumbnail");
  const [note, setNote] = useState("");

  function load() {
    return fetch("/api/images")
      .then((r) => r.json())
      .then((data) => setImages(data.images ?? []));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function addImage() {
    if (!title || !url) {
      setMessage({ type: "error", text: "タイトル・画像URLはどちらも必須です" });
      return;
    }
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, url, useCase, note }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: body.error ?? "保存に失敗しました" });
      return;
    }

    setTitle("");
    setUrl("");
    setNote("");
    setMessage({ type: "success", text: "保存しました。次回の画像生成から反映されます。" });
    await load();
  }

  async function removeImage(id: string, imageTitle: string) {
    if (!confirm(`「${imageTitle}」を削除しますか？`)) return;
    setSaving(true);
    setMessage(null);

    const res = await fetch(`/api/images?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: body.error ?? "削除に失敗しました" });
      return;
    }

    await load();
  }

  if (loading) return <p>読み込み中...</p>;

  return (
    <div>
      <div className="card">
        <p style={{ marginTop: 0 }}>
          参考画像の実体はGoogleドライブに格納する運用です。以下のフォルダに格納してください。
        </p>
        <p style={{ marginBottom: 0 }}>
          格納先: <a href={DRIVE_FOLDER_URL} target="_blank" rel="noreferrer">{DRIVE_FOLDER_URL}</a>
        </p>
      </div>

      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      {images.length === 0 && (
        <div className="card">
          <p style={{ margin: 0 }}>登録されている画像はありません。</p>
        </div>
      )}

      {images.map((img) => (
        <div className="item" key={img.id}>
          <div className="item-header">
            <div>
              <strong>{img.title}</strong>
              <br />
              <span className="badge">{USE_CASE_LABEL[img.useCase] ?? img.useCase}</span>
            </div>
            <button className="danger" onClick={() => removeImage(img.id, img.title)} disabled={saving}>
              削除
            </button>
          </div>
          <p style={{ margin: "6px 0" }}>
            画像格納: <a href={img.url} target="_blank" rel="noreferrer">{img.url}</a>
            {img.note && (
              <>
                <br />
                メモ: {img.note}
              </>
            )}
          </p>
        </div>
      ))}

      <div className="card">
        <h3>新しい画像を追加</h3>
        <label>タイトル</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: 標準サムネイルデザイン(2026年版)" />

        <label>画像格納(Googleドライブの共有リンク、または画像の直接URL)</label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://drive.google.com/... または https://example.com/image.png"
        />

        <label>どういったケースで使うか</label>
        <select value={useCase} onChange={(e) => setUseCase(e.target.value as ImageUseCase)}>
          {(Object.keys(USE_CASE_LABEL) as ImageUseCase[]).map((key) => (
            <option key={key} value={key}>
              {USE_CASE_LABEL[key]}
            </option>
          ))}
        </select>
        <p style={{ marginTop: 4, marginBottom: 0, color: "var(--muted)", fontSize: 13 }}>
          {USE_CASE_HELP[useCase]}
        </p>

        <label>メモ(任意)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="例: 左側にアイコン、右側にタイトル風のスペースを空けたレイアウト" />

        <button onClick={addImage} disabled={saving}>
          {saving ? "保存中..." : "追加する"}
        </button>
      </div>
    </div>
  );
}
