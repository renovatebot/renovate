import type { XmlDocument } from 'xmldoc';
import type { Result } from '../../../util/result';
import type { ReleaseResult } from '../types';

export interface MavenDependency {
  display: string;
  group?: string;
  name?: string;
  dependencyUrl: string;
}

export interface MavenXml {
  isCacheable?: boolean;
  xml?: XmlDocument;
}

export type HttpResourceCheckResult = 'found' | 'not-found' | 'error' | Date;

export type DependencyInfo = Pick<
  ReleaseResult,
  | 'homepage'
  | 'sourceUrl'
  | 'packageScope'
  | 'replacementName'
  | 'replacementVersion'
  | 'deprecationMessage'
>;

export interface MavenFetchSuccess<T = string> {
  isCacheable?: boolean;
  lastModified?: string;
  data: T;
}

export type MavenFetchError =
  | { type: 'invalid-url' }
  | { type: 'host-disabled' }
  | { type: 'not-found' }
  | { type: 'host-error' }
  | { type: 'permission-issue' }
  | { type: 'temporary-error' }
  | { type: 'maven-central-temporary-error'; err: Error }
  | { type: 'connection-error' }
  | { type: 'unsupported-host' }
  | { type: 'unsupported-format' }
  | { type: 'unsupported-protocol' }
  | { type: 'credentials-error' }
  | { type: 'missing-aws-region' }
  | { type: 'unknown'; err: Error };

export type MavenFetchResult<T = string> = Result<
  MavenFetchSuccess<T>,
  MavenFetchError
>;
