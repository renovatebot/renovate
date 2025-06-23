import { regEx } from '../../../util/regex';

const githubRepoPattern = regEx(/^https?:\/\/github\.com\/[^/]+\/[^/]+$/);

export function isGitHubRepo(url: string): boolean {
  return !url.includes('sponsors') && githubRepoPattern.test(url);
}

// https://packaging.python.org/en/latest/specifications/name-normalization/
export function normalizePythonDepName(name: string): string {
  return name.replace(/[-_.]+/g, '-').toLowerCase();
}
