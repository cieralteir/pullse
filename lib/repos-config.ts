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

  if (!Array.isArray(parsed) || !parsed.every(isRepoConfig)) {
    return {
      repos: [],
      error: `${filename} must be an array of { "owner": string, "repo": string }.`,
    };
  }

  return { repos: parsed, error: null };
}

export function readMyPRsReposConfig(configPath?: string): ReposConfigResult {
  return readReposConfig(configPath, { filename: MY_PRS_CONFIG_FILENAME, emptyIsError: false });
}

function isRepoConfig(value: unknown): value is RepoConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RepoConfig).owner === 'string' &&
    typeof (value as RepoConfig).repo === 'string'
  );
}
