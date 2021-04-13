export interface VersionInfo {
  Version: string;
  Time?: string;
}

export enum GoproxyFallback {
  WhenNotFoundOrGone = ',',
  Always = '|',
}

export interface GoproxyHost {
  url: string;
  fallback: GoproxyFallback;
  disabled?: true;
}
