import { getVersioningList } from '../../lib/modules/versioning';
import { readFile, updateFile } from '../utils';
import { formatDescription, formatUrls, replaceContent } from './utils';

type Versioning = {
  id: string;
  displayName: string;
  urls?: string[];
  supportsRanges?: boolean;
  supportedRangeStrategies?: string[];
};

export async function generateVersioning(dist: string): Promise<void> {
  const versioningList = getVersioningList();
  let versioningContent =
    '\nSupported values for `versioning` are: ' +
    versioningList.map((v) => `\`${v}\``).join(', ') +
    '.\n\n';
  for (const versioning of versioningList) {
    const definition = (await import(
      `../../lib/modules/versioning/${versioning}`
    )) as Versioning;
    const { id, displayName, urls, supportsRanges, supportedRangeStrategies } =
      definition;
    versioningContent += `\n### ${displayName} Versioning\n\n`;
    versioningContent += `**Identifier**: \`${id}\`\n\n`;
    versioningContent += formatUrls(urls);
    versioningContent += `**Ranges/Constraints:**\n\n`;
    if (supportsRanges) {
      versioningContent += `✅ Ranges are supported.\n\nValid \`rangeStrategy\` values are: ${(
        supportedRangeStrategies ?? []
      )
        .map((strategy: string) => `\`${strategy}\``)
        .join(', ')}\n\n`;
    } else {
      versioningContent += `❌ No range support.\n\n`;
    }
    versioningContent += await formatDescription('versioning', versioning);
    versioningContent += `\n----\n\n`;
  }
  let indexContent = await readFile(`docs/usage/modules/versioning.md`);
  indexContent = replaceContent(indexContent, versioningContent);
  await updateFile(`${dist}/modules/versioning.md`, indexContent);
}
