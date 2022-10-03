export interface DotnetSdkReleasesIndex {
  'releases-index': ReleaseIndex[];
}

export type SupportPhase =
  | 'current'
  | 'eol'
  | 'lts'
  | 'maintenance'
  | 'preview'
  | 'rc';
export type Product = '.NET Core' | '.NET';

export interface ReleaseIndex {
  'channel-version': string;
  'latest-release': string;
  'latest-release-date': string;
  security: boolean;
  'latest-runtime': string;
  'latest-sdk': string;
  product: Product;
  'support-phase': SupportPhase;
  'eol-date': string | null;
  'releases.json': string;
}

export interface DotnetSdkReleases {
  'channel-version': string;
  'latest-release': string;
  'latest-release-date': Date;
  'latest-runtime': string;
  'latest-sdk': string;
  'support-phase': SupportPhase;
  'lifecycle-policy': string;
  releases: Release[];
  'eol-date'?: Date;
}

export interface Release {
  'release-date': Date;
  'release-version': string;
  security: boolean;
  'release-notes': string;
  runtime: Runtime;
  sdk: Sdk;
  sdks: Sdk[] | null;
}

export interface Sdk {
  version: string;
  'version-display': string;
}

export interface Runtime {
  version: string;
  'version-display': string;
}
