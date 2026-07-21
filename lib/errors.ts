export interface GithubApiErrorLike {
  status: number;
  response?: { headers?: Record<string, string> };
}

function isGithubApiErrorLike(error: unknown): error is GithubApiErrorLike {
  return typeof error === 'object' && error !== null && typeof (error as { status?: unknown }).status === 'number';
}

export function isRateLimitError(error: unknown): error is GithubApiErrorLike {
  return isGithubApiErrorLike(error) && (error.status === 403 || error.status === 429);
}

export function getRateLimitResetMinutes(error: GithubApiErrorLike, now: number): number {
  const resetHeader = error.response?.headers?.['x-ratelimit-reset'];
  if (!resetHeader) return 1;
  const resetMs = Number(resetHeader) * 1000;
  const minutes = Math.ceil((resetMs - now) / 60000);
  return Math.max(1, minutes);
}

export function describeSectionError(error: unknown, now: number): string {
  if (isRateLimitError(error)) {
    return `Rate limited, try again in ${getRateLimitResetMinutes(error, now)}m`;
  }
  return 'Something went wrong loading this section.';
}
