import { readFile } from 'node:fs/promises';
import { Command } from 'commander';
import { parse } from 'yaml';
import { init, logger } from '../lib/logger/index.ts';
import { exec } from './utils/exec.ts';

const defaultRepo = 'renovatebot/renovate';
const labelActionsFile = '.github/label-actions.yml';

interface CliOptions {
  repo: string;
  showCommands?: boolean;
  create?: boolean;
}

const autoLabelColor = 'f9d0c4';

function getCreateArgs(repo: string, label: string): string[] {
  const args = ['label', 'create', label, '-R', repo];
  if (label.startsWith('auto:')) {
    args.push('--color', autoLabelColor);
  }
  return args;
}

async function getExpectedLabels(): Promise<string[]> {
  const content = await readFile(labelActionsFile, 'utf8');
  return Object.keys(parse(content) as Record<string, unknown>).sort();
}

async function getRepoLabels(repo: string): Promise<string[]> {
  const result = await exec('gh', [
    'label',
    'list',
    '-R',
    repo,
    '--limit',
    '1000',
    '--json',
    'name',
  ]);

  return (JSON.parse(result.stdout) as { name: string }[]).map((l) => l.name);
}

await init();

process.on('unhandledRejection', (err) => {
  // Will print "unhandledRejection err is not defined"
  logger.error({ err }, 'unhandledRejection');
  process.exit(-1);
});

const program = new Command('node tools/sync-label-actions-labels.ts')
  .description(`Check that labels used in ${labelActionsFile} exist.`)
  .option('--repo <owner/name>', 'Repository to query', defaultRepo)
  .option(
    '--show-commands',
    'Print gh label create commands for any missing labels',
  )
  .option('--create', 'Create any missing labels')
  .action(async (options: CliOptions) => {
    const expectedLabels = await getExpectedLabels();
    // GitHub label names are case-insensitive
    const existing = new Set(
      (await getRepoLabels(options.repo)).map((l) => l.toLowerCase()),
    );
    const missingLabels = expectedLabels.filter(
      (l) => !existing.has(l.toLowerCase()),
    );

    if (missingLabels.length === 0) {
      logger.info(`All ${labelActionsFile} labels exist in ${options.repo}.`);
      return;
    }

    logger.error(
      `Missing ${missingLabels.length} ${labelActionsFile} labels in ${options.repo}:\n${missingLabels.join('\n')}`,
    );

    if (options.create) {
      for (const label of missingLabels) {
        await exec('gh', getCreateArgs(options.repo, label));
        logger.info(`Created label ${label}`);
      }
      return;
    }

    if (options.showCommands) {
      logger.info(
        `Run the following commands to create the missing labels:\n${missingLabels
          .map((l) => `gh ${getCreateArgs(options.repo, l).join(' ')}`)
          .join('\n')}`,
      );
    }

    process.exitCode = 1;
  });

void program.parseAsync();
