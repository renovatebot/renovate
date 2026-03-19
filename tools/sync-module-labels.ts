import process from 'node:process';
import { pathToFileURL } from 'node:url';
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
  write: boolean;
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

export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    repo: defaultRepo,
    write: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case '--repo':
        index += 1;
        if (!args[index]) {
          throw new Error('Missing value for --repo');
        }
        options.repo = args[index];
        break;
      case '--write':
        options.write = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        return options;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
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

async function createMissingLabels(
  repo: string,
  labels: GitHubLabel[],
): Promise<void> {
  for (const label of labels) {
    await exec('gh', [
      'label',
      'create',
      label.name,
      '-R',
      repo,
      '--color',
      label.color,
      '--description',
      label.description,
    ]);
  }
}

function printHelp(): void {
  console.log(`Check that datasource/manager/platform GitHub labels exist.

Usage:
  node tools/sync-module-labels.ts [--repo owner/name] [--write]

Options:
  --repo   Repository to query and update (default: ${defaultRepo})
  --write  Create any missing labels with the default color and description
`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const expectedLabels = getExpectedModuleLabels();
  const existingLabels = await getRepoLabels(options.repo);
  const missingLabels = getMissingModuleLabels(expectedLabels, existingLabels);

  if (missingLabels.length === 0) {
    console.log(
      `All datasource/manager/platform labels exist in ${options.repo}.`,
    );
    return;
  }

  if (options.write) {
    await createMissingLabels(options.repo, missingLabels);
    console.log(
      `Created ${missingLabels.length} missing datasource/manager/platform labels in ${options.repo}:`,
    );
  } else {
    console.error(
      `Missing ${missingLabels.length} datasource/manager/platform labels in ${options.repo}:`,
    );
  }

  console.log(formatMissingLabels(missingLabels));

  if (!options.write) {
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
