import changelogUrlsJson from '../../data/changelog-urls.json';
import sourceUrlsJson from '../../data/source-urls.json';

const { $schema: changelogSchema, ...changelogUrls } = changelogUrlsJson;
// Only necessary when the changelog data cannot be found in the package's source repository
export const manualChangelogUrls: Record<
  string,
  Record<string, string>
> = changelogUrls;

const { $schema: sourceUrlSchema, ...sourceUrls } = sourceUrlsJson;
// Only necessary when the changelog data cannot be found in the package's source repository
export const manualSourceUrls: Record<
  string,
  Record<string, string>
> = sourceUrls;
