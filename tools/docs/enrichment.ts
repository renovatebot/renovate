import { codeBlock } from 'common-tags';
import { getEnrichments } from '../../lib/modules/enrichment/index.ts';
import { readFile, updateFile } from '../utils/index.ts';
import {
  type OpenItems,
  generateFeatureAndBugMarkdown,
} from './github-query-items.ts';
import { getDisplayName, getModuleLink, replaceContent } from './utils.ts';

export async function generateEnrichment(
  dist: string,
  issuesMap: OpenItems,
): Promise<void> {
  const moduleList = getEnrichments();

  for (const [id, enrichment] of moduleList) {
    const displayName = getDisplayName(id, enrichment);
    let md = codeBlock`
      ---
      title: ${displayName}
      edit_url: https://github.com/renovatebot/renovate/edit/main/lib/modules/platform/${id}/readme.md
      ---

      # ${displayName} Enrichment
      `;
    md += '\n\n';

    const contents = await readFile(`lib/modules/enrichment/${id}/readme.md`);
    md += contents;

    function isSupported(opt: boolean | undefined): string {
      if (opt === true) {
        return '✅';
      }

      return '❌';
    }

    md += codeBlock`
      ## Capabilities

      ${displayName} has the following capabilities:

      | Capability | Supported |
      | ---------- | --------- |
      | Produces [\`packageRules\`](../../../configuration-options.md#packagerules) | ${isSupported(enrichment.capabilities.producesPackageRules)} |
      | Produces [\`prBodyNotes\`](../../../configuration-options.md#prbodynotes) | ${isSupported(enrichment.capabilities.producesPrBodyNotes)} |
      | Produces [\`skipReasons\`](../../../configuration-options.md#skipReasons) | ${isSupported(enrichment.capabilities.producesSkipReasons)} |
      | Produces Merge Confidence data for [\`matchConfidence\`](../../../configuration-options.md#matchConfidence) | ${isSupported(enrichment.capabilities.producesMergeConfidenceLevel)} |
      `;

    md += '\n\n';

    if (enrichment.capabilities.metadataFields?.length) {
      md += 'Additionally, the following metadata fields are exposed:';

      // TODO
      // TODO
      // TODO example with matchJsonata
      // TODO
      // TODO

      md += '\n\n';
    }

    if (enrichment.supportedDatasources) {
      md += codeBlock`
      ## Supported datasources

      ${displayName} only supports a subset of Renovate's [Datasources](../datasources.md):`;
      md += '\n\n';

      for (const datasource of enrichment.supportedDatasources) {
        md += `- [${datasource}](../datasources/${datasource}/index.md)\n`;
      }
      md += '\n\n';
    }

    md += generateFeatureAndBugMarkdown(issuesMap, id);

    await updateFile(`${dist}/modules/enrichment/${id}/index.md`, md);
  }

  let enrichmentContent = 'Supported values for `platform` are: \n\n';
  for (const [id] of moduleList) {
    enrichmentContent += `* ${getModuleLink(id, `\`${id}\``)}\n`;
  }

  let indexContent = await readFile(`docs/usage/modules/enrichment/index.md`);
  indexContent = replaceContent(indexContent, enrichmentContent);
  await updateFile(`${dist}/modules/enrichment/index.md`, indexContent);
}
