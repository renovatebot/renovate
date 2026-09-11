import { codeBlock } from 'common-tags';
import { communityActions } from '../../../../lib/modules/manager/github-actions/community.ts';
import { readFile, updateFile } from '../../../utils/index.ts';
import { replaceContent } from '../../utils.ts';
import { determineDependencyToUpdate, getWithSchemaFields } from './utils.ts';

function generateToolingTable(): string {
  let table = codeBlock`
    | Action | \`with\` input(s) used | Dependency |
    | --- | --- | --- |
    `;
  table += '\n';

  for (const [name, cfg] of Object.entries(communityActions)) {
    // `actions/*` are GitHub's own first-party Actions, documented separately
    // as "built-in" rather than here as community-maintained.
    if (name.startsWith('actions/')) {
      continue;
    }

    const withFields = getWithSchemaFields(cfg.withSchema);

    table += `| [\`${name}\`](https://github.com/${name}) | \`${withFields.join('`, `')}\` | ${determineDependencyToUpdate(cfg)} |\n`;
  }

  return table;
}

export async function generateManagerGithubActionsCommunity(
  dist: string,
): Promise<void> {
  const indexFileName = `${dist}/modules/manager/github-actions/index.md`;
  let indexContent = await readFile(indexFileName);
  indexContent = replaceContent(indexContent, generateToolingTable());
  await updateFile(
    `${dist}/modules/manager/github-actions/index.md`,
    indexContent,
  );
}
