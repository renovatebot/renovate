import changelogUrls from '../../data/changelog-urls.json';
import sourceUrls from '../../data/source-urls.json';

// Only necessary when the changelog data cannot be found in the package's source repository
export const manualChangelogUrls: Record<
  string,
  Record<string, string>
> = changelogUrls;

// Only necessary if the datasource is unable to locate the source URL itself
export const manualSourceUrls: Record<
  string,
  Record<string, string>
> = sourceUrls;
