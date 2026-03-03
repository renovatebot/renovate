import changelogUrlsJson from '../../data/changelog-urls.json' with { type: 'json' };
import sourceUrlsJson from '../../data/source-urls.json' with { type: 'json' };

const { $schema: _changelogSchema, ...changelogUrls } = changelogUrlsJson;
// Only necessary when the changelog data cannot be found in the package's source repository
export const manualChangelogUrls: Record<
  string,
  Record<string, string>
> = changelogUrls;

const { $schema: _sourceUrlSchema, ...sourceUrls } = sourceUrlsJson;
// Only necessary when the changelog data cannot be found in the package's source repository
export const manualSourceUrls: Record<
  string,
  Record<string, string>
> = sourceUrls;
