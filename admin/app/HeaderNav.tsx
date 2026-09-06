"use client";

import { usePathname, useRouter } from "next/navigation";

export default function HeaderNav() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/login") {
    return (
      <header className="header">
        <h1>BondAIメディア コンテンツ管理</h1>
      </header>
    );
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="header">
      <h1>BondAIメディア コンテンツ管理</h1>
      <nav>
        <a href="/">ダッシュボード</a>
        <a href="/generate">記事を生成</a>
        <a href="/ctas">CTA</a>
        <a href="/style-references">参考記事</a>
        <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}>
          ログアウト
        </a>
      </nav>
    </header>
  );
}
