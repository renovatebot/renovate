import { codeBlock } from 'common-tags';
import platforms from '../../lib/modules/platform/api.ts';
import { readFile, updateFile } from '../utils/index.ts';
import type { OpenItems } from './github-query-items.ts';
import { generateFeatureAndBugMarkdown } from './github-query-items.ts';
import { getModuleLink, replaceContent } from './utils.ts';

export async function generatePlatforms(
  dist: string,
  platformIssuesMap: OpenItems,
): Promise<void> {
  for (const [id, platform] of platforms) {
    let md = codeBlock`
      ---
      edit_url: https://github.com/renovatebot/renovate/edit/main/lib/modules/platform/${id}/readme.md
      ---
      `;
    md += '\n\n';

    const contents = await readFile(`lib/modules/platform/${id}/readme.md`);
    const lines = contents.split('\n');

    if (platform.experimental) {
      // make sure that we don't mangle the <h1> of the page, as it is used to infer the page title by Mkdocs
      md += lines[0]; // title of the platform
      md += '\n\n';

      md += codeBlock`
        <!-- prettier-ignore -->
        !!! warning "This feature is flagged as experimental"
            Experimental features might be changed or even removed at any time.
      `;
      md += '\n\n';

      md += lines.slice(1).join('\n');
    }

    md += contents;
    md += generateFeatureAndBugMarkdown(platformIssuesMap, id);

    await updateFile(`${dist}/modules/platform/${id}/index.md`, md);
  }

  let platformContent = 'Supported values for `platform` are: \n\n';
  for (const [id, platform] of platforms) {
    if (platform.experimental) {
      continue;
    }

    platformContent += `* ${getModuleLink(id, `\`${id}\``)}\n`;
  }

  platformContent +=
    '\nAdditionally, the following `platform` values are experimental:\n\n';

  for (const [id, platform] of platforms) {
    if (!platform.experimental) {
      continue;
    }

    platformContent += `* ${getModuleLink(id, `\`${id}\``)}\n`;
  }

  let indexContent = await readFile(`docs/usage/modules/platform/index.md`);
  indexContent = replaceContent(indexContent, platformContent);
  await updateFile(`${dist}/modules/platform/index.md`, indexContent);
}
