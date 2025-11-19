import { regEx } from '../../../util/regex';

const githubRepoPattern = regEx(
  /^https?:\/\/github\.com\/(?<projectName>[^/]+)\/[^/]+$/,
);

export function isGitHubRepo(url: string): boolean {
  const m = url.match(githubRepoPattern);
  return !!m && m.groups?.projectName !== 'sponsors';
}

// https://packaging.python.org/en/latest/specifications/name-normalization/
export function normalizePythonDepName(name: string): string {
  return name.replace(/[-_.]+/g, '-').toLowerCase();
}
