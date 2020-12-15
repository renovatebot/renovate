import { readFile, updateFile } from '../utils/index.js';
import { formatDescription, formatUrls, replaceContent } from './utils.js';

export async function generateVersioning() {
  const versionIndex = await import('../../dist/versioning/index.js');
  const versioningList = versionIndex.getVersioningList();
  let versioningContent =
    '\nSupported values for `versioning` are: ' +
    versioningList.map((v) => `\`${v}\``).join(', ') +
    '.\n\n';
  for (const versioning of versioningList) {
    const definition = await import(
      `../../dist/versioning/${versioning}/index.js`
    );
    const {
      id,
      displayName,
      urls,
      supportsRanges,
      supportedRangeStrategies,
    } = definition;
    versioningContent += `\n### ${displayName} Versioning\n\n`;
    versioningContent += `**Identifier**: \`${id}\`\n\n`;
    versioningContent += formatUrls(urls);
    versioningContent += `**Ranges/Constraints:**\n\n`;
    if (supportsRanges) {
      versioningContent += `✅ Ranges are supported.\n\nValid \`rangeStrategy\` values are: ${(
        supportedRangeStrategies || []
      )
        .map((strategy) => `\`${strategy}\``)
        .join(', ')}\n\n`;
    } else {
      versioningContent += `❌ No range support.\n\n`;
    }
    versioningContent += await formatDescription('versioning', versioning);
    versioningContent += `\n----\n\n`;
  }
  let indexContent = await readFile(`../usage/modules/versioning.md`);
  indexContent = replaceContent(indexContent, versioningContent);
  await updateFile('./docs/modules/versioning.md', indexContent);
}
