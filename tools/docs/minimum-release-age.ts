import { isNonEmptyString } from '@sindresorhus/is';
import { getDatasources } from '../../lib/modules/datasource/index.ts';
import { getManagers } from '../../lib/modules/manager/index.ts';
import type { MinimumReleaseAgeToolCapability } from '../../lib/modules/manager/types.ts';
import { readFile, updateFile } from '../utils/index.ts';
import { getDisplayName, replaceContent } from './utils.ts';

function generateDatasourceTable(): string {
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

  return tableContent;
}

function mark(value: MinimumReleaseAgeToolCapability | undefined): string {
  if (isNonEmptyString(value)) {
    return `✅<br>\`${value}\``;
  }
  return value ? '✅' : '❌';
}

function generateManagerTable(): string {
  const managers = getManagers();

  let tableContent =
    '| Manager | Package manager | Passed to the package manager | Reads its setting | Enforced in lock file maintenance | Notes |\n';
  tableContent += '| :-- | :-- | :-: | :-: | :-: | :-- |\n';

  const sortedManagers = [...managers].sort(([a], [b]) => a.localeCompare(b));
  for (const [manager, definition] of sortedManagers) {
    const { minimumReleaseAgeSupport } = definition;
    if (!minimumReleaseAgeSupport) {
      continue;
    }
    const displayName = getDisplayName(manager, definition);
    const packageManagers = Object.entries(minimumReleaseAgeSupport).sort(
      ([a], [b]) => a.localeCompare(b),
    );
    for (const [packageManager, support] of packageManagers) {
      tableContent += `| [${displayName}](../modules/manager/${manager}/index.md) | ${packageManager} | ${mark(support.passesMinimumReleaseAge)} | ${mark(support.readsConfiguredAge)} | ${mark(support.enforcedInLockFile)} | ${support.note ?? ''} |\n`;
    }
  }

  return tableContent;
}

export async function generateMinimumReleaseAgePage(
  dist: string,
): Promise<void> {
  let content = await readFile(
    'docs/usage/key-concepts/minimum-release-age.md',
  );
  content = replaceContent(
    content,
    `${generateDatasourceTable()}\n`,
    '<!-- Autogenerate datasourceReleaseTimestampSupport -->',
  );
  content = replaceContent(
    content,
    `${generateManagerTable()}\n`,
    '<!-- Autogenerate managerMinimumReleaseAgeSupport -->',
  );
  await updateFile(`${dist}/key-concepts/minimum-release-age.md`, content);
}
