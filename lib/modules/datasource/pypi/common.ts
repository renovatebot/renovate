import { regEx } from '../../../util/regex';

const githubRepoPattern = regEx(/^https?:\/\/github\.com\/[^/]+\/[^/]+$/);

export function isGitHubRepo(url: string): boolean {
  return !url.includes('sponsors') && githubRepoPattern.test(url);
}
