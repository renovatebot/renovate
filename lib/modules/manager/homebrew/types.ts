export interface UrlPathParsedResult {
  currentValue: string;
  ownerName: string;
  repoName: string;
}

export interface HomebrewManagerData {
  ownerName: string | null;
  repoName: string | null;
  sha256: string | null;
  url: string | null;
}
