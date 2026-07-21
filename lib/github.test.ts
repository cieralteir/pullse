import { describe, it, expect, afterEach } from 'vitest';
import { Octokit } from '@octokit/rest';
import { getOctokit, GithubTokenMissingError } from './github';

describe('getOctokit', () => {
  const originalToken = process.env.GITHUB_TOKEN;

  afterEach(() => {
    process.env.GITHUB_TOKEN = originalToken;
  });

  it('throws GithubTokenMissingError when GITHUB_TOKEN is not set', () => {
    delete process.env.GITHUB_TOKEN;
    expect(() => getOctokit()).toThrow(GithubTokenMissingError);
  });

  it('constructs an Octokit client when GITHUB_TOKEN is set', () => {
    process.env.GITHUB_TOKEN = 'test-token';
    expect(getOctokit()).toBeInstanceOf(Octokit);
  });
});
