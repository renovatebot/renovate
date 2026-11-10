export type GitHubUrlType = 'archive' | 'releases';

// URL parsing result with urlType for datasource selection
export interface GitHubUrlParsedResult {
  type: 'github';
  currentValue: string;
  ownerName: string;
  repoName: string;
  urlType: GitHubUrlType;
}

// Manager data with type discriminator
export interface GitHubManagerData {
  type: 'github';
  ownerName: string;
  repoName: string;
  sha256: string | null;
  url: string | null;
}

// URL parsing result
export interface NpmUrlParsedResult {
  type: 'npm';
  currentValue: string;
  packageName: string;
}

// Manager data with type discriminator
export interface NpmManagerData {
  type: 'npm';
  packageName: string;
  sha256: string | null;
  url: string | null;
}

// Future extensibility for additional datasources
export type UrlParsedResult = GitHubUrlParsedResult | NpmUrlParsedResult;

export type HomebrewManagerData = GitHubManagerData | NpmManagerData;
