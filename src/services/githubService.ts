/**
 * githubService — GitHub Contents API wrapper.
 *
 * Pure HTTPS REST — no git binary needed.
 * Template repo is hardcoded; PAT is injected at call time.
 *
 * API flow:
 *   1. GET  /repos/{owner}/{repo}/contents/{path}  → current content (base64) + SHA
 *   2. Mutate the source string
 *   3. PUT  /repos/{owner}/{repo}/contents/{path}  → commit with old SHA
 */

export const TEMPLATE_OWNER = 'MahtoHimanshu';
export const TEMPLATE_REPO  = 'website-service';
export const TEMPLATE_FILE  = 'site.config.ts';

const GITHUB_API = 'https://api.github.com';

interface GitHubFileResponse {
  content: string;   // base64-encoded, may contain newlines
  sha: string;
  html_url: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

function b64Decode(b64: string): string {
  // Strip newlines GitHub inserts every 60 chars, then decode
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
}

function b64Encode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

function authHeaders(pat: string) {
  return {
    Authorization: `token ${pat}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

// ─── API calls ────────────────────────────────────────────────────

async function getFile(pat: string): Promise<GitHubFileResponse> {
  const res = await fetch(
    `${GITHUB_API}/repos/${TEMPLATE_OWNER}/${TEMPLATE_REPO}/contents/${TEMPLATE_FILE}`,
    { headers: authHeaders(pat) },
  );

  if (res.status === 401) throw new Error('GitHub: Invalid token — authentication failed.');
  if (res.status === 403) throw new Error('GitHub: Token lacks the "repo" scope.');
  if (res.status === 404) throw new Error(`GitHub: "${TEMPLATE_FILE}" not found in the template repo.`);
  if (!res.ok) throw new Error(`GitHub: Unexpected error HTTP ${res.status}.`);

  return res.json() as Promise<GitHubFileResponse>;
}

async function putFile(
  pat: string,
  content: string,
  sha: string,
  message: string,
): Promise<void> {
  const res = await fetch(
    `${GITHUB_API}/repos/${TEMPLATE_OWNER}/${TEMPLATE_REPO}/contents/${TEMPLATE_FILE}`,
    {
      method: 'PUT',
      headers: authHeaders(pat),
      body: JSON.stringify({ message, content: b64Encode(content), sha }),
    },
  );

  if (res.status === 401) throw new Error('GitHub: Invalid token — authentication failed.');
  if (res.status === 403) throw new Error('GitHub: Token lacks write access to this repo.');
  if (res.status === 409) throw new Error('GitHub: Conflict — file changed remotely. Please retry.');
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `GitHub: HTTP ${res.status}`);
  }
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Prepend `// webforge: {comment}` to site.config.ts and push a commit.
 *
 * Also refreshes the "last updated from connector" timestamp so it's
 * always clear when the last push happened.
 *
 * Returns the GitHub URL of the updated file.
 */
export async function pushComment(pat: string, comment: string): Promise<string> {
  const file = await getFile(pat);
  const source = b64Decode(file.content);

  const timestamp  = new Date().toISOString();
  const commentLine = `// webforge: ${comment}`;

  // Update the timestamp line if it exists, then inject the comment below it
  let newSource: string;
  if (source.startsWith('// last updated from connector:')) {
    const afterFirstLine = source.slice(source.indexOf('\n') + 1);
    newSource = `// last updated from connector: ${timestamp}\n${commentLine}\n${afterFirstLine}`;
  } else {
    newSource = `// last updated from connector: ${timestamp}\n${commentLine}\n${source}`;
  }

  const commitMsg = `webforge: ${comment.slice(0, 72)}`;
  await putFile(pat, newSource, file.sha, commitMsg);

  return file.html_url;
}
