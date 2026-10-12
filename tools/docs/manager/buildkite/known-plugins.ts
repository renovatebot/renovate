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

function generatePluginTable(): string {
  let table = codeBlock`
    | Plugin | Config field(s) used | Dependency | Enabled |
    | --- | --- | --- | --- |
    `;
  table += '\n';

  for (const [name, cfg] of Object.entries(knownPlugins)) {
    const enabled = cfg.enabled !== false;
    table += `| [\`${name}\`](${pluginRepoUrl(name)}) | \`${cfg.fields.join('`, `')}\` | ${determineDependencyToUpdate(cfg.dependency)} | ${enabled ? '✅' : '❌'} |\n`;
  }

  return `Renovate supports extracting embedded dependencies from the following ${Object.keys(knownPlugins).length} plugins:\n\n${table}`;
}

export async function generateManagerKnownBuildkitePlugins(
  dist: string,
): Promise<void> {
  const indexFileName = `${dist}/modules/manager/buildkite/index.md`;
  let indexContent = await readFile(indexFileName);
  indexContent = replaceContent(indexContent, generatePluginTable());
  await updateFile(indexFileName, indexContent);
}
