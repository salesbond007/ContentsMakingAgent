"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "ダッシュボード", subtitle: "コンテンツ制作パイプラインの概要" },
  "/analytics": { title: "数値解析", subtitle: "公開記事数の推移(日次・月次)" },
  "/generate": { title: "コンテンツ生成", subtitle: "自動生成とは別に、キーワードやCTAを指定して記事を生成します" },
  "/review-queue": { title: "確認待ち", subtitle: "手動生成した記事を確認し、CMSへの反映を承認・却下します" },
  "/ctas": { title: "CTA", subtitle: "記事に挿入する行動喚起リンクの追加・編集・削除" },
  "/style-references": { title: "参考記事", subtitle: "執筆エージェントが構造・トーンの参考にする記事の管理" },
  "/thumbnail": { title: "サムネイル", subtitle: "アイキャッチ画像生成のデザイン参考" },
  "/targets": { title: "ターゲット", subtitle: "想定読者プロフィールの追加・編集・削除" },
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
