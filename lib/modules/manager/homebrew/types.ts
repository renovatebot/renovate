import type {
  GitHubManagerData,
  GitHubUrlParsedResult,
} from './handlers/github.ts';
import type { NpmManagerData, NpmUrlParsedResult } from './handlers/npm.ts';

// Future extensibility for additional datasources
export type UrlParsedResult = GitHubUrlParsedResult | NpmUrlParsedResult;

export type HomebrewManagerData = GitHubManagerData | NpmManagerData;
