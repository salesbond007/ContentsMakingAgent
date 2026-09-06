const API_BASE = "https://api.github.com";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} が設定されていません`);
  return value;
}

function repoInfo() {
  return { owner: env("GITHUB_OWNER"), repo: env("GITHUB_REPO") };
}

async function githubFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env("GITHUB_TOKEN")}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  return res;
}

/** リポジトリ内のJSONファイルを取得する。存在しない場合はnullを返す。 */
export async function getRepoJsonFile<T>(path: string): Promise<{ data: T; sha: string } | null> {
  const { owner, repo } = repoInfo();
  const res = await githubFetch(`/repos/${owner}/${repo}/contents/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);

  const json = (await res.json()) as { content: string; sha: string; encoding: string };
  const decoded = Buffer.from(json.content, "base64").toString("utf-8");
  return { data: JSON.parse(decoded) as T, sha: json.sha };
}

/** リポジトリ内のJSONファイルを更新する（コミットを作成する）。 */
export async function updateRepoJsonFile(path: string, data: unknown, sha: string, message: string): Promise<void> {
  const { owner, repo } = repoInfo();
  const content = Buffer.from(JSON.stringify(data, null, 2) + "\n", "utf-8").toString("base64");

  const res = await githubFetch(`/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content,
      sha,
      branch: "main",
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  }
}

/**
 * GitHub ActionsのRepository variable(Settings > Secrets and variables > Actions > Variables)を取得する。
 * 存在しない場合はnullを返す。
 */
export async function getRepoVariable(name: string): Promise<string | null> {
  const { owner, repo } = repoInfo();
  const res = await githubFetch(`/repos/${owner}/${repo}/actions/variables/${name}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { value: string };
  return json.value;
}

/** Repository variableを更新する。存在しない場合は新規作成する。 */
export async function setRepoVariable(name: string, value: string): Promise<void> {
  const { owner, repo } = repoInfo();
  const existing = await getRepoVariable(name);

  const res = await githubFetch(
    existing === null
      ? `/repos/${owner}/${repo}/actions/variables`
      : `/repos/${owner}/${repo}/actions/variables/${name}`,
    {
      method: existing === null ? "POST" : "PATCH",
      body: JSON.stringify({ name, value }),
    }
  );

  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  }
}

/**
 * リポジトリ内のJSON配列ログファイルに1件追記する。ファイルが存在しない場合は新規作成する。
 * 配列が長くなりすぎないよう、末尾maxEntries件だけを保持する。
 */
export async function appendJsonArrayEntry<T>(
  path: string,
  key: string,
  entry: T,
  message: string,
  maxEntries = 200
): Promise<void> {
  const { owner, repo } = repoInfo();
  const existing = await getRepoJsonFile<Record<string, T[]>>(path);
  const data = existing?.data ?? ({} as Record<string, T[]>);
  const arr = Array.isArray(data[key]) ? data[key] : [];
  arr.push(entry);
  data[key] = arr.slice(-maxEntries);

  if (existing) {
    await updateRepoJsonFile(path, data, existing.sha, message);
    return;
  }

  const content = Buffer.from(JSON.stringify(data, null, 2) + "\n", "utf-8").toString("base64");
  const res = await githubFetch(`/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({ message, content, branch: "main" }),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  }
}

/** Daily Content Pipelineのworkflow_dispatchを手動発火する。 */
export async function dispatchContentWorkflow(inputs: {
  keyword?: string;
  cta_id?: string;
  source_urls?: string;
}): Promise<void> {
  const { owner, repo } = repoInfo();
  const res = await githubFetch(`/repos/${owner}/${repo}/actions/workflows/daily-content.yml/dispatches`, {
    method: "POST",
    body: JSON.stringify({
      ref: "main",
      inputs: {
        keyword: inputs.keyword ?? "",
        cta_id: inputs.cta_id ?? "",
        source_urls: inputs.source_urls ?? "",
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub Actions dispatch error ${res.status}: ${await res.text()}`);
  }
}
