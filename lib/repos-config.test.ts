import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readReposConfig, readMyPRsReposConfig, parseReposEnv } from './repos-config';

let dir: string | undefined;

afterEach(() => {
  if (dir) {
    rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  }
});

function writeConfig(contents: string): string {
  dir = mkdtempSync(path.join(tmpdir(), 'pullse-test-'));
  const configPath = path.join(dir, 'repos.config.json');
  writeFileSync(configPath, contents);
  return configPath;
}

function writeConfigFile(filename: string, contents: string): string {
  dir = mkdtempSync(path.join(tmpdir(), 'pullse-test-'));
  const configPath = path.join(dir, filename);
  writeFileSync(configPath, contents);
  return configPath;
}

describe('readReposConfig', () => {
  it('parses a valid list of repos', () => {
    const configPath = writeConfig(JSON.stringify([{ owner: 'someorg', repo: 'some-repo' }]));
    expect(readReposConfig(configPath)).toEqual({
      repos: [{ owner: 'someorg', repo: 'some-repo' }],
      error: null,
    });
  });

  it('returns an empty list with an error when the file is missing', () => {
    const missingPath = path.join(tmpdir(), 'pullse-test-missing-dir', 'repos.config.json');
    const result = readReposConfig(missingPath);
    expect(result.repos).toEqual([]);
    expect(result.error).toMatch(/No repos\.config\.json found/);
  });

  it('returns an empty list with an error when the file is not valid JSON', () => {
    const configPath = writeConfig('{ not valid json');
    const result = readReposConfig(configPath);
    expect(result.repos).toEqual([]);
    expect(result.error).toMatch(/not valid JSON/);
  });

  it('returns an empty list with an error when entries are malformed', () => {
    const configPath = writeConfig(JSON.stringify([{ owner: 'someorg' }]));
    const result = readReposConfig(configPath);
    expect(result.repos).toEqual([]);
    expect(result.error).toMatch(/must be an array/);
  });

  it('returns a distinct error message for non-ENOENT read failures (e.g. EISDIR)', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'pullse-test-'));
    // Point configPath at a directory instead of a file, which typically produces EISDIR on read.
    const result = readReposConfig(dir);
    expect(result.repos).toEqual([]);
    expect(result.error).toMatch(/Could not read repos\.config\.json/);
    expect(result.error).not.toMatch(/No repos\.config\.json found/);
  });
});

describe('readReposConfig with emptyIsError: false', () => {
  it('returns no error when the file is missing', () => {
    const missingPath = path.join(tmpdir(), 'pullse-test-missing-dir', 'my-prs.config.json');
    const result = readReposConfig(missingPath, { filename: 'my-prs.config.json', emptyIsError: false });
    expect(result).toEqual({ repos: [], error: null });
  });

  it('still returns an error when the file is not valid JSON', () => {
    const configPath = writeConfigFile('my-prs.config.json', '{ not valid json');
    const result = readReposConfig(configPath, { filename: 'my-prs.config.json', emptyIsError: false });
    expect(result.repos).toEqual([]);
    expect(result.error).toMatch(/not valid JSON/);
  });

  it('still returns an error when entries are malformed', () => {
    const configPath = writeConfigFile('my-prs.config.json', JSON.stringify([{ owner: 'someorg' }]));
    const result = readReposConfig(configPath, { filename: 'my-prs.config.json', emptyIsError: false });
    expect(result.repos).toEqual([]);
    expect(result.error).toMatch(/must be an array/);
  });

  it('uses the custom filename in error messages', () => {
    const configPath = writeConfigFile('my-prs.config.json', '{ not valid json');
    const result = readReposConfig(configPath, { filename: 'my-prs.config.json' });
    expect(result.error).toMatch(/my-prs\.config\.json is not valid JSON/);
  });
});

describe('readMyPRsReposConfig', () => {
  it('parses a valid list of repos', () => {
    const configPath = writeConfigFile('my-prs.config.json', JSON.stringify([{ owner: 'someorg', repo: 'some-repo' }]));
    expect(readMyPRsReposConfig(configPath)).toEqual({
      repos: [{ owner: 'someorg', repo: 'some-repo' }],
      error: null,
    });
  });

  it('returns an empty list with no error when the file is missing', () => {
    const missingPath = path.join(tmpdir(), 'pullse-test-missing-dir', 'my-prs.config.json');
    expect(readMyPRsReposConfig(missingPath)).toEqual({ repos: [], error: null });
  });

  it('returns an empty list with no error when the file is an empty array', () => {
    const configPath = writeConfigFile('my-prs.config.json', '[]');
    expect(readMyPRsReposConfig(configPath)).toEqual({ repos: [], error: null });
  });

  it('returns an error when the file is not valid JSON', () => {
    const configPath = writeConfigFile('my-prs.config.json', '{ not valid json');
    const result = readMyPRsReposConfig(configPath);
    expect(result.repos).toEqual([]);
    expect(result.error).toMatch(/not valid JSON/);
  });
});

describe('readReposConfig with .env placeholders', () => {
  afterEach(() => {
    delete process.env.PULLSE_TEST_REPOS;
    delete process.env.PULLSE_TEST_OWNER;
  });

  it('fills "${VAR}" string entries from the environment', () => {
    process.env.PULLSE_TEST_REPOS = 'someorg/a,someorg/b';
    const configPath = writeConfig('["${PULLSE_TEST_REPOS}"]');
    expect(readReposConfig(configPath)).toEqual({
      repos: [
        { owner: 'someorg', repo: 'a' },
        { owner: 'someorg', repo: 'b' },
      ],
      error: null,
    });
  });

  it('fills placeholders inside object entries', () => {
    process.env.PULLSE_TEST_OWNER = 'someorg';
    const configPath = writeConfig('[{ "owner": "${PULLSE_TEST_OWNER}", "repo": "a" }]');
    expect(readReposConfig(configPath)).toEqual({
      repos: [{ owner: 'someorg', repo: 'a' }],
      error: null,
    });
  });

  it('returns an empty list when the variable is unset', () => {
    const configPath = writeConfig('["${PULLSE_TEST_REPOS}"]');
    expect(readReposConfig(configPath)).toEqual({ repos: [], error: null });
  });
});

describe('parseReposEnv', () => {
  it('parses a comma-separated owner/repo list', () => {
    expect(parseReposEnv('someorg/a, someorg/b')).toEqual({
      repos: [
        { owner: 'someorg', repo: 'a' },
        { owner: 'someorg', repo: 'b' },
      ],
      error: null,
    });
  });

  it('returns an error for malformed entries', () => {
    const result = parseReposEnv('someorg/a,bad-entry');
    expect(result.repos).toEqual([]);
    expect(result.error).toMatch(/GITHUB_REPOS must be/);
  });
});
