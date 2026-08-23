import { loadDotEnv } from './load-env';

loadDotEnv();

const API_BASE = 'https://api.github.com';

function repoAndToken() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) throw new Error('GITHUB_TOKEN and GITHUB_REPO must be set.');
  return { token, repo };
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export interface DirEntry {
  name: string;
  sha: string;
}

export interface FileContent {
  content: string;
  sha: string;
}

export async function listDir(path: string): Promise<DirEntry[]> {
  const { token, repo } = repoAndToken();
  const res = await fetch(`${API_BASE}/repos/${repo}/contents/${path}`, { headers: headers(token) });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub listDir(${path}) failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return (json as any[])
    .filter((entry) => entry.type === 'file' && entry.name.endsWith('.md'))
    .map((entry) => ({ name: entry.name, sha: entry.sha }));
}

export async function getFile(path: string): Promise<FileContent | null> {
  const { token, repo } = repoAndToken();
  const res = await fetch(`${API_BASE}/repos/${repo}/contents/${path}`, { headers: headers(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub getFile(${path}) failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return { content: Buffer.from(json.content, 'base64').toString('utf-8'), sha: json.sha };
}

export async function putFile(path: string, content: string, message: string, sha?: string): Promise<void> {
  const { token, repo } = repoAndToken();
  const res = await fetch(`${API_BASE}/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) throw new Error(`GitHub putFile(${path}) failed: ${res.status} ${await res.text()}`);
}

export async function deleteFile(path: string, sha: string, message: string): Promise<void> {
  const { token, repo } = repoAndToken();
  const res = await fetch(`${API_BASE}/repos/${repo}/contents/${path}`, {
    method: 'DELETE',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha }),
  });
  if (!res.ok) throw new Error(`GitHub deleteFile(${path}) failed: ${res.status} ${await res.text()}`);
}
