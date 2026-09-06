/**
 * Resend(https://resend.com/)経由でログインリンクをメール送信する。
 * RESEND_API_KEY が未設定の場合はエラーを投げる(呼び出し側でハンドリングする)。
 */
export async function sendMagicLinkEmail(to: string, link: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY が設定されていません");

  const from = process.env.MAIL_FROM ?? "BondAIメディア管理画面 <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "【BondAIメディア】ログインリンクのご案内",
      html:
        `<p>以下のリンクをクリックして管理画面にログインしてください（15分間有効です）。</p>` +
        `<p><a href="${link}">${link}</a></p>` +
        `<p>心当たりが無い場合はこのメールを無視してください。</p>`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend API error ${res.status}: ${await res.text()}`);
  }
}
