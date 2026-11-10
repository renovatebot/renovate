import {
  maybeSupportedBackendDatasources,
  supportedBackendDatasources,
} from '../../lib/modules/manager/mise/index.ts';
import {
  asdfTooling,
  miseTooling,
  parsedMiseRegistry,
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
  let content = '';
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

  for (const [name, backends] of Object.entries(parsedMiseRegistry.tools)) {
    if (existingTools.has(name)) {
      continue;
    }

    const backendNames = Object.keys(backends);
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

  const registrySupportedTools = Object.keys(parsedMiseRegistry.tools);
  for (const t of allTools) {
    if (!registrySupportedTools.includes(t.name)) {
      t.supported = false;
      t.supportNote = `No longer supported as of mise \`${parsedMiseRegistry.meta.version}\``;
    }
  }

  allTools = allTools.sort((a, b) => a.name.localeCompare(b.name));

  const total = allTools.length;
  const supportedCount = allTools.filter((t) => t.supported === true).length;
  const maybeCount = allTools.filter((t) => t.supported === 'maybe').length;
  const unsupportedCount = allTools.filter((t) => t.supported === false).length;

  content = `!!! note\n  Renovate syncs the supported registry data with mise, and is periodically updated (currently using \`${parsedMiseRegistry.meta.version}\`.<br>Over time, this support may change and short tool names may be added / removed as per upstream mise.\n`;

  content += `Renovate's \`mise\` manager can version the following tool short names.\nOut of ${total} known tools: ${supportedCount} supported, ${maybeCount} possibly supported, ${unsupportedCount} unsupported.\n`;

  content += `\n
| Name | Source | Supported |
| ---- | ------ | --------- |
  `;

  for (const { name, url, source, supported, supportNote } of allTools) {
    let supportedOutput = '❌';
    if (supported === true) {
      supportedOutput = '✅';
    } else if (supported === 'maybe') {
      supportedOutput = `🤔 ${supportNote}`;
    } else if (supportNote) {
      supportedOutput = `⚠️ ${supportNote}`;
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
