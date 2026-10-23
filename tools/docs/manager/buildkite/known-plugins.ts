import { codeBlock } from 'common-tags';
import { knownPlugins } from '../../../../lib/modules/manager/buildkite/known-plugins.ts';
import { readFile, updateFile } from '../../../utils/index.ts';
import { replaceContent } from '../../utils.ts';

function pluginRepoUrl(name: string): string {
  const parts = name.split('/');
  const repo =
    parts.length === 1
      ? `buildkite-plugins/${name}-buildkite-plugin`
      : `${name}-buildkite-plugin`;
  return `https://github.com/${repo}`;
}

function determineDependencyToUpdate(dependency: string | undefined): string {
  if (!dependency) {
    return '(determined from config)';
  }
  return `\`${dependency}\``;
}

function isOfficial(name: string): boolean {
  return !name.includes('/');
}

function generatePluginTable(): string {
  let table = codeBlock`
    | Plugin | Config field(s) used | Dependency |
    | --- | --- | --- |
    `;
  table += '\n';

  // official (`buildkite-plugins` org) plugins first, otherwise keeping the declared order
  const plugins = Object.entries(knownPlugins);
  const sorted = [
    ...plugins.filter(([name]) => isOfficial(name)),
    ...plugins.filter(([name]) => !isOfficial(name)),
  ];

  let hasDisabled = false;
  for (const [name, cfg] of sorted) {
    const disabled = cfg.enabled === false;
    hasDisabled ||= disabled;
    const marker = disabled ? '<sup>1</sup>' : '';
    table += `| [\`${name}\`](${pluginRepoUrl(name)})${marker} | \`${cfg.fields.join('`, `')}\` | ${determineDependencyToUpdate(cfg.dependency)} |\n`;
  }

  let result = `Renovate supports extracting embedded dependencies from the following ${plugins.length} plugins:\n\n${table}`;
  if (hasDisabled) {
    result += '\n<sup>1</sup> Not enabled by default.\n';
  }
  return result;
}

export async function generateManagerKnownBuildkitePlugins(
  dist: string,
): Promise<void> {
  const indexFileName = `${dist}/modules/manager/buildkite/index.md`;
  let indexContent = await readFile(indexFileName);
  indexContent = replaceContent(indexContent, generatePluginTable());
  await updateFile(indexFileName, indexContent);
}
