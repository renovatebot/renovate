import { codeBlock } from 'common-tags';
import { communityActions } from '../../../../lib/modules/manager/github-actions/community.ts';
import { builtinVersionedActions } from '../../../../lib/modules/manager/github-actions/extract.ts';
import { readFile, updateFile } from '../../../utils/index.ts';
import { replaceContent } from '../../utils.ts';
import { determineDependencyToUpdate, getWithSchemaFields } from './utils.ts';

const replaceStart =
  '<!-- Autogenerate list of built-in actions in https://github.com/renovatebot/renovate -->';

function generateToolingTable(): string {
  let table = codeBlock`
    | Action | \`with\` input(s) used | Dependency | Default versioning |
    | --- | --- | --- | --- |
    `;
  table += '\n';

  for (const [action, versioning] of Object.entries(builtinVersionedActions)) {
    const actionName = `actions/setup-${action}`;
    const packageName = `actions/${action}-versions`;
    table += `| [\`${actionName}\`](https://github.com/${actionName}) | \`${action}-version\` | [\`${action}\`](https://github.com/${packageName}) | [\`${versioning}\`](../../versioning/${versioning}/index.md) |\n`;
  }

  // `actions/*` community-action-config entries: GitHub's own first-party
  // Actions that need a schema richer than the simple
  // `builtinVersionedActions` map above, so they're configured alongside
  // community actions but documented here as built-in.
  for (const [name, cfg] of Object.entries(communityActions)) {
    if (!name.startsWith('actions/')) {
      continue;
    }

    const withFields = getWithSchemaFields(cfg.withSchema);
    const versioning = cfg.versioning
      ? `[\`${cfg.versioning}\`](../../versioning/${cfg.versioning}/index.md)`
      : '`default`';

    table += `| [\`${name}\`](https://github.com/${name}) | \`${withFields.join('`, `')}\` | ${determineDependencyToUpdate(cfg)} | ${versioning} |\n`;
  }

  return table;
}

export async function generateManagerGithubActionsBuiltin(
  dist: string,
): Promise<void> {
  const indexFileName = `${dist}/modules/manager/github-actions/index.md`;
  let indexContent = await readFile(indexFileName);
  indexContent = replaceContent(
    indexContent,
    generateToolingTable(),
    replaceStart,
  );
  await updateFile(indexFileName, indexContent);
}
