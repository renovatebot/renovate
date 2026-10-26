import { Command } from 'commander';
import { init, logger } from '../lib/logger/index.ts';
import { exec } from './utils/exec.ts';
import type { CliOptions, GitHubLabel } from './utils/sync-module-labels.ts';
import {
  formatCreateLabelCommands,
  formatMissingLabels,
  getExpectedModuleLabels,
  getMissingModuleLabels,
} from './utils/sync-module-labels.ts';

const defaultRepo = 'renovatebot/renovate';

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
  .option('--repo <owner/name>', `Repository to query`, defaultRepo)
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
