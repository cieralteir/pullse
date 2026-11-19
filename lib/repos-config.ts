import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { RepoConfig } from './github.types';

export interface ReposConfigResult {
  repos: RepoConfig[];
  error: string | null;
}

const CONFIG_FILENAME = 'repos.config.json';
const MY_PRS_CONFIG_FILENAME = 'my-prs.config.json';

export interface ReadReposConfigOptions {
  filename?: string;
  emptyIsError?: boolean;
}

export function readReposConfig(
  configPath?: string,
  options: ReadReposConfigOptions = {}
): ReposConfigResult {
  const filename = options.filename ?? CONFIG_FILENAME;
  const emptyIsError = options.emptyIsError ?? true;
  const resolvedPath = configPath ?? path.join(process.cwd(), filename);

  let raw: string;
  try {
    raw = readFileSync(resolvedPath, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      if (!emptyIsError) {
        return { repos: [], error: null };
      }
      return {
        repos: [],
        error: `No ${filename} found in project root. Add one to track repos.`,
      };
    }
    return {
      repos: [],
      error: `Could not read ${filename}: ${code ?? 'unknown error'}.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { repos: [], error: `${filename} is not valid JSON.` };
  }

  if (
    !Array.isArray(parsed) ||
    !parsed.every((entry) => isRepoConfig(entry) || typeof entry === 'string')
  ) {
    return {
      repos: [],
      error: `${filename} must be an array of { "owner": string, "repo": string } or "owner/repo" strings.`,
    };
  }

  // Strings may be "owner/repo" lists and may reference .env values as ${VAR}.
  const repos: RepoConfig[] = [];
  for (const entry of parsed as (RepoConfig | string)[]) {
    if (typeof entry === 'string') {
      const result = parseReposEnv(expandEnv(entry));
      if (result.error) return result;
      repos.push(...result.repos);
    } else {
      repos.push({ owner: expandEnv(entry.owner), repo: expandEnv(entry.repo) });
    }
  }

  return { repos, error: null };
}

function expandEnv(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, name: string) => process.env[name] ?? '');
}

export function readMyPRsReposConfig(configPath?: string): ReposConfigResult {
  return readReposConfig(configPath, { filename: MY_PRS_CONFIG_FILENAME, emptyIsError: false });
}

export function parseReposEnv(value: string): ReposConfigResult {
  const repos: RepoConfig[] = [];
  for (const entry of value.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [owner, repo, ...rest] = entry.split('/');
    if (!owner || !repo || rest.length > 0) {
      return { repos: [], error: 'GITHUB_REPOS must be a comma-separated list of owner/repo.' };
    }
    repos.push({ owner, repo });
  }
  return { repos, error: null };
}

function isRepoConfig(value: unknown): value is RepoConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RepoConfig).owner === 'string' &&
    typeof (value as RepoConfig).repo === 'string'
  );
}
