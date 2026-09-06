import type { Metadata } from "next";
import "./globals.css";
import HeaderNav from "./HeaderNav";

export const metadata: Metadata = {
  title: "BondAIメディア コンテンツ管理",
  description: "コンテンツ制作パイプラインの管理画面",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <HeaderNav />
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
