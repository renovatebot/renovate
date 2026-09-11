import { codeBlock } from 'common-tags';
import { builtinVersionedActions } from '../../../../lib/modules/manager/github-actions/extract.ts';
import { readFile, updateFile } from '../../../utils/index.ts';
import { replaceContent } from '../../utils.ts';

const replaceStart =
  '<!-- Autogenerate list of built-in actions in https://github.com/renovatebot/renovate -->';

function generateToolingTable(): string {
  let table = codeBlock`
    | Action | \`with\` input used | Dependency | Default versioning |
    | --- | --- | --- | --- |
    `;
  table += '\n';

  for (const [action, versioning] of Object.entries(builtinVersionedActions)) {
    const actionName = `actions/setup-${action}`;
    const packageName = `actions/${action}-versions`;
    table += `| [\`${actionName}\`](https://github.com/${actionName}) | \`${action}-version\` | [\`${action}\`](https://github.com/${packageName}) | [\`${versioning}\`](../../versioning/${versioning}/index.md) |\n`;
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
