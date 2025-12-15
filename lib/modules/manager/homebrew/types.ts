import type {
  GitHubManagerData,
  GitHubUrlParsedResult,
} from './handlers/github';

// Future extensibility for additional datasources
export type UrlParsedResult = GitHubUrlParsedResult; // | NpmUrlParsedResult

export type HomebrewManagerData = GitHubManagerData; // | NpmManagerData
