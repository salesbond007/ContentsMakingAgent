"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailLoading(true);
    setEmailError(null);

    const res = await fetch("/api/auth/request-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setEmailLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setEmailError(body.error ?? "送信に失敗しました");
      return;
    }

    setEmailSent(true);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError(null);

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setPasswordLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setPasswordError(body.error ?? "ログインに失敗しました");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="login-shell" style={{ position: "fixed", inset: 0 }}>
      <div className="login-box card">
        <div className="card-icon" style={{ width: 44, height: 44, fontSize: 20 }}>◆</div>
        <h2>BondAIメディア コンテンツ管理</h2>

        {linkError === "invalid_link" && (
          <div className="message error">リンクが無効か、有効期限(15分)が切れています。もう一度送信してください。</div>
        )}

        {emailSent ? (
          <div className="message success">
            {email} 宛にログインリンクを送信しました。メールを確認してリンクをクリックしてください。
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit}>
            <label htmlFor="email">会社のメールアドレスでログイン</label>
            <input
              id="email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@salesbond.jp"
              autoFocus
            />
            {emailError && <div className="message error">{emailError}</div>}
            <button type="submit" disabled={emailLoading} style={{ width: "100%" }}>
              {emailLoading ? "送信中..." : "ログインリンクを送る"}
            </button>
          </form>
        )}

        <div style={{ textAlign: "center", margin: "18px 0", color: "var(--muted)", fontSize: 12 }}>または</div>

        {!showPassword ? (
          <button className="secondary" style={{ width: "100%" }} onClick={() => setShowPassword(true)}>
            パスワードでログイン
          </button>
        ) : (
          <form onSubmit={handlePasswordSubmit}>
            <label htmlFor="password">パスワード</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {passwordError && <div className="message error">{passwordError}</div>}
            <button type="submit" disabled={passwordLoading} style={{ width: "100%" }}>
              {passwordLoading ? "確認中..." : "ログイン"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
