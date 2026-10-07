import type { DatasourceName } from '../../../datasource-list.generated.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from '../types.ts';

/** The part of a `*-tags` datasource which a delegating lookup uses. */
export interface TagsApi {
  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null>;
  getDigest(config: DigestConfig, newValue?: string): Promise<string | null>;
}

/** A `*-tags` datasource which reads the API of one git hosting platform. */
export interface PlatformTagsDatasource {
  readonly id: DatasourceName;
  readonly api: TagsApi;
  /** Browser URL of a repository of the platform. */
  readonly getSourceUrl: (packageName: string, registryUrl?: string) => string;
}

/** A repository URL, resolved to the platform datasource which can serve it. */
export interface PlatformTagsLookup extends PlatformTagsDatasource {
  /** The origin of the URL, which is the datasource's `registryUrl`. */
  readonly registryUrl: string;
  /** The repository path, which is the datasource's `packageName`. */
  readonly packageName: string;
}
