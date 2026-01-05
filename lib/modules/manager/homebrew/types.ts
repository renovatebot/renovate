import type {
  GitHubManagerData,
  GitHubUrlParsedResult,
} from './handlers/github';
import type { NpmManagerData, NpmUrlParsedResult } from './handlers/npm';

// Future extensibility for additional datasources
export type UrlParsedResult = GitHubUrlParsedResult | NpmUrlParsedResult;

export type HomebrewManagerData = GitHubManagerData | NpmManagerData;
