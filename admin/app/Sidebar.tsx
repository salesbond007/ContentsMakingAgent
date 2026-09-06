"use client";

import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "ダッシュボード", icon: "◆" },
  { href: "/generate", label: "記事を生成", icon: "✎" },
  { href: "/ctas", label: "CTA", icon: "🔗" },
  { href: "/style-references", label: "文体の参考記事", icon: "📄" },
  { href: "/settings", label: "設定", icon: "⚙" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

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
        {NAV_ITEMS.map((item) => (
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
