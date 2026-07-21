import { Octokit } from '@octokit/rest';

export class GithubTokenMissingError extends Error {
  constructor() {
    super('GITHUB_TOKEN is not set');
    this.name = 'GithubTokenMissingError';
  }
}

export function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new GithubTokenMissingError();
  }
  return new Octokit({ auth: token });
}
