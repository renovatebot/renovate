import type { DatasourceName } from '../../../datasource-list.generated.ts';
import type { GitHostTagsDigestDatasource } from '../git-host-tags.ts';

/** A repository URL, resolved to the platform datasource which can serve it. */
export interface PlatformTagsLookup {
  /** The id of {@link PlatformTagsLookup.datasource}. */
  readonly id: DatasourceName;
  readonly datasource: GitHostTagsDigestDatasource;
  /** The origin of the URL, which is the datasource's `registryUrl`. */
  readonly registryUrl: string;
  /** The repository path, which is the datasource's `packageName`. */
  readonly packageName: string;
}
