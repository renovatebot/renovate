import miseRegistry from '../../lib/data/mise-registry.json' with { type: 'json' };
import {
  maybeSupportedBackendDatasources,
  supportedBackendDatasources,
} from '../../lib/modules/manager/mise/index.ts';
import {
  asdfTooling,
  miseTooling,
} from '../../lib/modules/manager/mise/upgradeable-tooling.ts';
import { readFile, updateFile } from '../utils/index.ts';
import { replaceContent } from './utils.ts';

interface ToolDocumentation {
  name: string;
  url?: string;
  source: 'asdf' | 'mise';
  supported: boolean | 'maybe';
  supportNote?: string;
}

const defaultMisePluginUrl = 'https://mise.jdx.dev/registry.html#tools';

function generateCombinedTooling(): string {
  let content = `
  | Name | Source | Supported |
  | ---- | ------ | --------- |
  `;
  const registry = miseRegistry as Record<string, string[]>;

  let allTools: ToolDocumentation[] = [
    ...Object.entries(miseTooling).map(
      ([name, { misePluginUrl }]) =>
        ({
          name,
          url: misePluginUrl,
          source: 'mise',
          supported: true,
        }) satisfies ToolDocumentation,
    ),
    ...Object.entries(asdfTooling).map(
      ([name, { asdfPluginUrl }]) =>
        ({
          name,
          url: asdfPluginUrl,
          source: 'asdf',
          supported: true,
        }) satisfies ToolDocumentation,
    ),
  ];

  const existingTools = new Set(allTools.map((tool) => tool.name));

  for (const [name, backends] of Object.entries(registry)) {
    if (existingTools.has(name)) {
      continue;
    }

    const backendNames = backends.map((b) => b.split(':')[0]);
    if (backendNames.some((b) => supportedBackendDatasources.has(b))) {
      allTools.push({
        name,
        url: defaultMisePluginUrl,
        source: 'mise',
        supported: true,
      });
    } else if (
      backendNames.some((b) => maybeSupportedBackendDatasources.has(b))
    ) {
      allTools.push({
        name,
        url: defaultMisePluginUrl,
        source: 'mise',
        supported: 'maybe',
        supportNote: `Possibly unsupported due to backend(s): \`${JSON.stringify(backendNames)}\``,
      });
    } else {
      allTools.push({
        name,
        url: defaultMisePluginUrl,
        source: 'mise',
        supported: false,
      });
    }
  }

  allTools = allTools.sort((a, b) => a.name.localeCompare(b.name));

  const total = allTools.length;
  const supportedCount = allTools.filter((t) => t.supported === true).length;
  const maybeCount = allTools.filter((t) => t.supported === 'maybe').length;
  const unsupportedCount = allTools.filter((t) => t.supported === false).length;

  content =
    `Renovate's \`mise\` manager can version the following tool short names.\nOut of ${total} known tools: ${supportedCount} supported, ${maybeCount} possibly supported, ${unsupportedCount} unsupported.\n` +
    content;

  for (const { name, url, source, supported, supportNote } of allTools) {
    let supportedOutput = '❌';
    if (supported === true) {
      supportedOutput = '✅';
    } else if (supported === 'maybe') {
      supportedOutput = `🤔 ${supportNote}`;
    }

    if (url) {
      content += `| [\`${name}\`](${url}) | ${source} | ${supportedOutput} | \n`;
    } else {
      content += `| \`${name}\`           | ${source} | ${supportedOutput} | \n`;
    }
  }

  return content;
}

export async function generateManagerMiseSupportedPlugins(
  dist: string,
): Promise<void> {
  const indexFileName = `${dist}/modules/manager/mise/index.md`;
  let indexContent = await readFile(indexFileName);
  // Combine the output of both mise and asdf tooling generation
  const combinedTooling = generateCombinedTooling();
  indexContent = replaceContent(indexContent, combinedTooling);
  await updateFile(indexFileName, indexContent);
}
