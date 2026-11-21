import type { GetReleasesConfig } from '../types.ts';

export interface GithubTagsReleasesConfig extends GetReleasesConfig {
  /** Server-side tag name filter, forwarded to the GraphQL `refs(query:)` argument. */
  refQuery?: string;
}
