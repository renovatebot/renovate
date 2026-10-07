import type { DatasourceName } from '../../../datasource-list.generated.ts';
import type { Datasource } from '../datasource.ts';
import type { DigestConfig } from '../types.ts';

/**
 * A `*-tags` datasource which reads the API of one git hosting platform: it
 * resolves digests, and it knows the browser URL of a repository without
 * calling the API.
 */
export interface PlatformTagsDatasource extends Datasource {
  getDigest(config: DigestConfig, newValue?: string): Promise<string | null>;
  /**
   * Browser URL of the repository `packageName` on `registryUrl`, or on the
   * default registry.
   */
  getSourceUrl(packageName: string, registryUrl?: string): string;
}

/** A repository URL, resolved to the platform datasource which can serve it. */
export interface PlatformTagsLookup {
  /** The id of {@link PlatformTagsLookup.datasource}. */
  readonly id: DatasourceName;
  readonly datasource: PlatformTagsDatasource;
  /** The origin of the URL, which is the datasource's `registryUrl`. */
  readonly registryUrl: string;
  /** The repository path, which is the datasource's `packageName`. */
  readonly packageName: string;
}
