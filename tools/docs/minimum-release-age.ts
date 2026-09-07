import { getDatasources } from '../../lib/modules/datasource/index.ts';
import { readFile, updateFile } from '../utils/index.ts';
import { getDisplayName, replaceContent } from './utils.ts';

export async function generateDatasourceReleaseTimestampSupportForMinimumReleaseAge(
  dist: string,
): Promise<void> {
  const datasources = getDatasources();

  let tableContent = '| Datasource | Supports release timestamp? | Notes |\n';
  tableContent += '| :-- | :-: | :-- |\n';

  for (const [datasource, definition] of datasources) {
    const displayName = getDisplayName(datasource, definition);
    const { releaseTimestampSupport, releaseTimestampNote } = definition;
    const supported = releaseTimestampSupport
      ? '🟠<br>Maybe<sup>1</sup>'
      : '❌';
    tableContent += `| [${displayName}](../modules/datasource/${datasource}/index.md) | ${supported} | ${releaseTimestampNote ?? ''} |\n`;
  }

  tableContent +=
    '\n<sup>1</sup> Whether release timestamps are actually available depends on the registry you use - check [Which registries support release timestamps?](#which-registries-support-release-timestamps).\n';

  let content = await readFile(
    'docs/usage/key-concepts/minimum-release-age.md',
  );
  content = replaceContent(
    content,
    `${tableContent}\n`,
    '<!-- Autogenerate datasourceReleaseTimestampSupport -->',
  );
  await updateFile(`${dist}/key-concepts/minimum-release-age.md`, content);
}
