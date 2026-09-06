"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "ログインに失敗しました");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="login-box card">
      <h2>ログイン</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="password">パスワード</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <div className="message error">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? "確認中..." : "ログイン"}
        </button>
      </form>
    </div>
  );
}
