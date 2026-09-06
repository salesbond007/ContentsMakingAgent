import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "BondAIメディア コンテンツ管理",
  description: "コンテンツ制作パイプラインの管理画面",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={inter.variable}>
      <body>
        <div className="shell">
          <Sidebar />
          <div className="main">
            <TopBar />
            <div className="content">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
