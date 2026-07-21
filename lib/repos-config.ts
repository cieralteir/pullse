import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { RepoConfig } from './github.types';

export interface ReposConfigResult {
  repos: RepoConfig[];
  error: string | null;
}

const CONFIG_FILENAME = 'repos.config.json';

export function readReposConfig(
  configPath: string = path.join(process.cwd(), CONFIG_FILENAME)
): ReposConfigResult {
  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return {
        repos: [],
        error: `No ${CONFIG_FILENAME} found in project root. Add one to track repos.`,
      };
    }
    return {
      repos: [],
      error: `Could not read ${CONFIG_FILENAME}: ${code ?? 'unknown error'}.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { repos: [], error: `${CONFIG_FILENAME} is not valid JSON.` };
  }

  if (!Array.isArray(parsed) || !parsed.every(isRepoConfig)) {
    return {
      repos: [],
      error: `${CONFIG_FILENAME} must be an array of { "owner": string, "repo": string }.`,
    };
  }

  return { repos: parsed, error: null };
}

function isRepoConfig(value: unknown): value is RepoConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RepoConfig).owner === 'string' &&
    typeof (value as RepoConfig).repo === 'string'
  );
}
