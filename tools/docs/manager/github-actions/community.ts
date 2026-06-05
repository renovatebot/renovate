import type { CommunityActionConfig } from '../../../../lib/modules/manager/github-actions/community.ts';
import { communityActions } from '../../../../lib/modules/manager/github-actions/community.ts';
import { readFile, updateFile } from '../../../utils/index.ts';
import { replaceContent } from '../../utils.ts';

function generateTool({ depName, packageName }: CommunityActionConfig): string {
  if (!depName && !packageName) {
    // some actions determine the depName and packageName dynamically
    return '';
  }
  return ` ([\`${depName ?? packageName}\`](https://github.com/${packageName}))`;
}

function generateTooling(): string {
  return Object.entries(communityActions)
    .map(
      ([name, cfg]) =>
        `- [\`${name}\`](https://github.com/${name})${generateTool(cfg)}`,
    )
    .join('\n');
}

export async function generateManagerGithubActionsCommunity(
  dist: string,
): Promise<void> {
  const indexFileName = `${dist}/modules/manager/github-actions/index.md`;
  let indexContent = await readFile(indexFileName);
  indexContent = replaceContent(indexContent, generateTooling());
  await updateFile(
    `${dist}/modules/manager/github-actions/index.md`,
    indexContent,
  );
}
