"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const TOP_NAV_ITEMS = [
  { href: "/", label: "ダッシュボード", icon: "◆" },
  { href: "/analytics", label: "数値解析", icon: "📊" },
  { href: "/generate", label: "コンテンツ生成", icon: "✎" },
  { href: "/review-queue", label: "確認待ち", icon: "🕓" },
];

const DESIGN_NAV_ITEMS = [
  { href: "/ctas", label: "CTA", icon: "🔗" },
  { href: "/style-references", label: "参考記事", icon: "📄" },
  { href: "/thumbnail", label: "サムネイル", icon: "🖼" },
  { href: "/targets", label: "ターゲット", icon: "🎯" },
];

const BOTTOM_NAV_ITEMS = [{ href: "/settings", label: "設定", icon: "⚙" }];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [designOpen, setDesignOpen] = useState(DESIGN_NAV_ITEMS.some((i) => i.href === pathname));

  if (pathname === "/login") return null;

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark" />
        <div className="sidebar-brand-text">
          BondAIメディア
          <span>コンテンツ管理</span>
        </div>
      </div>

      <nav>
        {TOP_NAV_ITEMS.map((item) => (
          <a key={item.href} href={item.href} className={pathname === item.href ? "active" : ""}>
            <span className="icon">{item.icon}</span>
            {item.label}
          </a>
        ))}

        <button
          type="button"
          className="sidebar-group-toggle"
          onClick={() => setDesignOpen((v) => !v)}
        >
          <span className="icon">🧩</span>
          コンテンツ設計
          <span className="sidebar-group-caret">{designOpen ? "▾" : "▸"}</span>
        </button>
        {designOpen && (
          <div className="sidebar-group">
            {DESIGN_NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href} className={pathname === item.href ? "active" : ""}>
                <span className="icon">{item.icon}</span>
                {item.label}
              </a>
            ))}
          </div>
        )}

        {BOTTOM_NAV_ITEMS.map((item) => (
          <a key={item.href} href={item.href} className={pathname === item.href ? "active" : ""}>
            <span className="icon">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>

      <div className="sidebar-footer">
        <a
          href="https://github.com/salesbond007/ContentsMakingAgent/actions"
          target="_blank"
          rel="noreferrer"
        >
          <span className="icon">↗</span>
          GitHub Actions
        </a>
        <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}>
          <span className="icon">⏻</span>
          ログアウト
        </a>
      </div>
    </aside>
  );
}
