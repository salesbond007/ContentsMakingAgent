"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "ダッシュボード", subtitle: "コンテンツ制作パイプラインの概要" },
  "/generate": { title: "記事を生成", subtitle: "自動生成とは別に、キーワードやCTAを指定して1本生成します" },
  "/ctas": { title: "CTA管理", subtitle: "記事に挿入する行動喚起リンクの追加・編集・削除" },
  "/style-references": { title: "文体の参考記事", subtitle: "執筆エージェントが参考にする記事の管理" },
  "/settings": { title: "設定", subtitle: "1日あたりの生成本数などパイプラインの動作設定" },
};

export default function TopBar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  const info = TITLES[pathname] ?? { title: "BondAIメディア コンテンツ管理", subtitle: "" };

  return (
    <div className="topbar">
      <div>
        <h1>{info.title}</h1>
        {info.subtitle && <p>{info.subtitle}</p>}
      </div>
    </div>
  );
}
