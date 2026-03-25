import process from 'node:process';
import { Command } from 'commander';
import { quote } from 'shlex';
import { init, logger } from '../lib/logger/index.ts';
import { getDatasourceList } from '../lib/modules/datasource/index.ts';
import { allManagersList } from '../lib/modules/manager/index.ts';
import { getPlatformList } from '../lib/modules/platform/index.ts';
import { exec } from './utils/exec.ts';

export type ModuleLabelKind = 'datasource' | 'manager' | 'platform';

export interface GitHubLabel {
  color: string;
  description: string;
  name: string;
}

export interface CliOptions {
  repo: string;
  showCommands: boolean;
}

const defaultRepo = 'renovatebot/renovate';
const moduleLabelColor = 'C5DEF5';

export function getLabelDescription(
  kind: ModuleLabelKind,
  moduleId: string,
): string {
  return `Related to the ${moduleId} ${kind}`;
}

export function createModuleLabel(
  kind: ModuleLabelKind,
  moduleId: string,
): GitHubLabel {
  return {
    color: moduleLabelColor,
    description: getLabelDescription(kind, moduleId),
    name: `${kind}:${moduleId}`,
  };
}

function getSortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function getExpectedModuleLabels(): GitHubLabel[] {
  const datasources = getSortedUnique(getDatasourceList()).map((datasource) =>
    createModuleLabel('datasource', datasource),
  );
  const managers = getSortedUnique(allManagersList).map((manager) =>
    createModuleLabel('manager', manager),
  );
  const platforms = getSortedUnique(getPlatformList()).map((platform) =>
    createModuleLabel('platform', platform),
  );

  return [...datasources, ...managers, ...platforms].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export function getMissingModuleLabels(
  expectedLabels: GitHubLabel[],
  existingLabels: GitHubLabel[],
): GitHubLabel[] {
  const existingNames = new Set(existingLabels.map((label) => label.name));

  return expectedLabels.filter((label) => !existingNames.has(label.name));
}

export function formatMissingLabels(labels: GitHubLabel[]): string {
  const sections: Record<ModuleLabelKind, string[]> = {
    datasource: [],
    manager: [],
    platform: [],
  };

  for (const label of labels) {
    const kind = label.name.split(':')[0] as ModuleLabelKind;
    sections[kind].push(label.name);
  }

  const lines: string[] = [];

  for (const kind of ['datasource', 'manager', 'platform'] as const) {
    const names = sections[kind];
    if (names.length === 0) {
      continue;
    }
    lines.push(`${kind}s (${names.length}):`);
    for (const name of names) {
      lines.push(`- ${name}`);
    }
  }

  return lines.join('\n');
}

export function getCreateLabelCommand(
  repo: string,
  label: GitHubLabel,
): string {
  return (
    `gh label create ${quote(label.name)} -R ${quote(repo)}` +
    ` --color ${quote(label.color)}` +
    ` --description ${quote(label.description)}`
  );
}

export function formatCreateLabelCommands(
  repo: string,
  labels: GitHubLabel[],
): string {
  return [...labels]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((label) => getCreateLabelCommand(repo, label))
    .join('\n');
}

async function getRepoLabels(repo: string): Promise<GitHubLabel[]> {
  const result = await exec('gh', [
    'label',
    'list',
    '-R',
    repo,
    '--limit',
    '1000',
    '--json',
    'name,color,description',
  ]);

  const labels = JSON.parse(result.stdout) as GitHubLabel[];
  return labels.sort((left, right) => left.name.localeCompare(right.name));
}

await init();

process.on('unhandledRejection', (err) => {
  // Will print "unhandledRejection err is not defined"
  logger.error({ err }, 'unhandledRejection');
  process.exit(-1);
});

const program = new Command('node tools/sync-module-labels.ts')
  .description('Check that datasource/manager/platform GitHub labels exist.')
  .option(
    '--repo <owner/name>',
    `Repository to query (default: ${defaultRepo})`,
    defaultRepo,
  )
  .option(
    '--show-commands',
    'Print gh label create commands for any missing labels',
  )
  .action(async (options: CliOptions) => {
    const expectedLabels = getExpectedModuleLabels();
    const existingLabels = await getRepoLabels(options.repo);
    const missingLabels = getMissingModuleLabels(
      expectedLabels,
      existingLabels,
    );

    if (missingLabels.length === 0) {
      logger.info(
        `All datasource/manager/platform labels exist in ${options.repo}.`,
      );
      return;
    }

    logger.error(
      `Missing ${missingLabels.length} datasource/manager/platform labels in ${options.repo}:\n${formatMissingLabels(
        missingLabels,
      )}`,
    );

    if (options.showCommands) {
      logger.info(
        `Run the following commands to create the missing labels:\n${formatCreateLabelCommands(
          options.repo,
          missingLabels,
        )}`,
      );
    }

    process.exitCode = 1;
  });

void program.parseAsync();
