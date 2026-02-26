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

async function getFile(
  pat: string,
  owner: string,
  repo: string,
): Promise<GitHubFileResponse> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${TEMPLATE_FILE}`,
    { headers: authHeaders(pat) },
  );

  if (res.status === 401) throw new Error('GitHub: Invalid token — authentication failed.');
  if (res.status === 403) throw new Error('GitHub: Token lacks the "repo" scope.');
  if (res.status === 404) throw new Error(`GitHub: "${TEMPLATE_FILE}" not found in ${owner}/${repo}.`);
  if (!res.ok) throw new Error(`GitHub: Unexpected error HTTP ${res.status}.`);

  return res.json() as Promise<GitHubFileResponse>;
}

async function putFile(
  pat: string,
  owner: string,
  repo: string,
  content: string,
  sha: string,
  message: string,
): Promise<void> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${TEMPLATE_FILE}`,
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
 * Returns the GitHub login (username) for the given PAT.
 * Used to determine where to fork template repos.
 */
export async function getAuthenticatedUser(pat: string): Promise<string> {
  const res = await fetch(`${GITHUB_API}/user`, { headers: authHeaders(pat) });
  if (res.status === 401) throw new Error('GitHub: Invalid token — authentication failed.');
  if (!res.ok) throw new Error(`GitHub: Failed to fetch user (HTTP ${res.status}).`);
  const data = await res.json() as { login: string };
  return data.login;
}

/**
 * Creates a new GitHub repo from the website-service template.
 *
 * Uses the GitHub "Generate from template" API so the forked repo
 * is a clean copy (not a fork with a fork relationship).
 *
 * Returns the full repo name: "owner/repoName".
 */
export async function forkFromTemplate(
  pat: string,
  owner: string,
  repoName: string,
  projectName: string,
): Promise<string> {
  const res = await fetch(
    `${GITHUB_API}/repos/${TEMPLATE_OWNER}/${TEMPLATE_REPO}/generate`,
    {
      method: 'POST',
      headers: authHeaders(pat),
      body: JSON.stringify({
        owner,
        name: repoName,
        description: `WebForge project: ${projectName}`,
        private: false,
        include_all_branches: false,
      }),
    },
  );

  if (res.status === 401) throw new Error('GitHub: Invalid token — authentication failed.');
  if (res.status === 403) throw new Error('GitHub: Token lacks the "repo" scope.');
  if (res.status === 422) throw new Error(`GitHub: Repo "${repoName}" already exists.`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `GitHub: Failed to create repo (HTTP ${res.status}).`);
  }

  const data = await res.json() as { full_name: string };
  return data.full_name; // "owner/repoName"
}

/**
 * Returns the current source of site.config.ts plus its blob SHA,
 * needed for the subsequent PUT to avoid conflicts.
 */
export async function fetchSiteConfig(
  pat: string,
  owner: string,
  repo: string,
): Promise<{ source: string; sha: string }> {
  const file = await getFile(pat, owner, repo);
  return { source: b64Decode(file.content), sha: file.sha };
}

/**
 * Returns the decoded source of catalogue.ts.
 * Returns '' if the file does not exist (catalogue is optional).
 */
export async function fetchCatalogue(
  pat: string,
  owner: string,
  repo: string,
): Promise<string> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/catalogue.ts`,
    { headers: authHeaders(pat) },
  );
  if (res.status === 404) return '';
  if (res.status === 401) throw new Error('GitHub: Invalid token — authentication failed.');
  if (res.status === 403) throw new Error('GitHub: Token lacks the "repo" scope.');
  if (!res.ok) throw new Error(`GitHub: Unexpected error HTTP ${res.status}.`);
  const data = await res.json() as GitHubFileResponse;
  return b64Decode(data.content);
}

/**
 * Commits an updated site.config.ts to the project's repo.
 * Commit message is derived from the user's instruction (first 64 chars).
 */
export async function pushSiteConfig(
  pat: string,
  owner: string,
  repo: string,
  newSource: string,
  sha: string,
  instruction: string,
): Promise<void> {
  const commitMsg = `feat(webforge): ${instruction.slice(0, 64)}`;
  await putFile(pat, owner, repo, newSource, sha, commitMsg);
}

/**
 * Prepend `// webforge: {comment}` to site.config.ts and push a commit.
 *
 * Targets the project's own repo if owner+repo are supplied,
 * otherwise falls back to the shared template repo.
 *
 * Returns the GitHub URL of the updated file.
 */
export async function pushComment(
  pat: string,
  comment: string,
  owner = TEMPLATE_OWNER,
  repo  = TEMPLATE_REPO,
): Promise<string> {
  const file = await getFile(pat, owner, repo);
  const source = b64Decode(file.content);

  const timestamp   = new Date().toISOString();
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
  await putFile(pat, owner, repo, newSource, file.sha, commitMsg);

  return file.html_url;
}
