import { codeBlock } from 'common-tags';
import { z } from 'zod/v4';
import type { CommunityActionConfig } from '../../../../lib/modules/manager/github-actions/community.ts';
import { communityActions } from '../../../../lib/modules/manager/github-actions/community.ts';
import { readFile, updateFile } from '../../../utils/index.ts';
import { replaceContent } from '../../utils.ts';

function getWithSchemaFields(
  schema: CommunityActionConfig['withSchema'],
): string[] {
  if (!schema) {
    return ['version'];
  }
  // `z.object({...}).transform(...)` produces a ZodPipe in Zod v4, where
  // `def.in` is the source ZodObject. Walk through any pipes until we hit it.
  let current: z.ZodType = schema;
  while ('in' in current.def) {
    current = current.def.in as z.ZodType;
  }
  if (current instanceof z.ZodObject) {
    return Object.keys(current.shape);
  }
  return ['version'];
}

function determineDependencyToUpdate({
  depName,
  packageName,
}: CommunityActionConfig): string {
  if (!depName && !packageName) {
    // some actions determine the depName and packageName dynamically
    return '(determined from `with` input(s))';
  }

  return `[\`${depName ?? packageName}\`](https://github.com/${packageName})`;
}

function generateToolingTable(): string {
  let table = codeBlock`
    | Action | \`with\` input(s) used | Dependency |
    | --- | --- | --- |
    `;
  table += '\n';

  for (const [name, cfg] of Object.entries(communityActions)) {
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
