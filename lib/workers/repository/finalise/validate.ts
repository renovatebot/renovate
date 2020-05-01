import JSON5 from 'json5';
import { RenovateConfig } from '../../../config';
import { configFileNames } from '../../../config/app-strings';
import { migrateAndValidate } from '../../../config/migrate-validate';
import { REPOSITORY_CHANGED } from '../../../constants/error-messages';
import { PR_STATE_OPEN } from '../../../constants/pull-requests';
import { logger } from '../../../logger';
import { Pr, platform } from '../../../platform';
import { BranchStatus } from '../../../types';

async function getRenovatePrs(branchPrefix: string): Promise<Pr[]> {
  return (await platform.getPrList())
    .filter((pr) => pr.state === PR_STATE_OPEN)
    .filter((pr) => pr.branchName && !pr.branchName.startsWith(branchPrefix))
    .filter((pr) => new RegExp('renovate', 'i').test(pr.title));
}

async function getRenovateFiles(prNo: number): Promise<string[]> {
  return (await platform.getPrFiles(prNo)).filter((file) =>
    configFileNames.includes(file)
  );
}

export async function validatePrs(config: RenovateConfig): Promise<void> {
  if (
    config.suppressNotifications &&
    config.suppressNotifications.includes('prValidation')
  ) {
    return;
  }
  logger.debug('branchPrefix: ' + config.branchPrefix);
  const renovatePrs = await getRenovatePrs(config.branchPrefix);
  logger.debug({ renovatePrs }, `Found ${renovatePrs.length} Renovate PRs`);
  let validations = [];
  for (const pr of renovatePrs) {
    try {
      const renovateFiles = await getRenovateFiles(pr.number);
      if (!renovateFiles.length) {
        continue; // eslint-disable-line no-continue
      }
      logger.debug(
        { prNo: pr.number, title: pr.title, renovateFiles },
        'PR has renovate files'
      );
      for (const file of renovateFiles) {
        let content: string;
        try {
          content = await platform.getFile(file, pr.sha || pr.branchName);
        } catch (err) /* istanbul ignore next */ {
          content = await platform.getFile(file, pr.branchName);
        }
        // TODO: proper typing
        let parsed: {
          renovate?: RenovateConfig;
          'renovate-config'?: RenovateConfig;
        } & RenovateConfig;
        try {
          // istanbul ignore if
          if (file.endsWith('.json5')) {
            parsed = JSON5.parse(content);
          } else {
            parsed = JSON.parse(content);
          }
        } catch (err) {
          validations.push({
            file,
            message: 'Invalid JSON',
          });
        }
        if (parsed) {
          const toValidate =
            file === 'package.json'
              ? /* istanbul ignore next */ parsed.renovate ||
                parsed['renovate-config']
              : parsed;
          // istanbul ignore else
          if (toValidate) {
            logger.debug({ config: toValidate }, 'Validating config');
            const { errors } = await migrateAndValidate(config, toValidate);
            if (errors && errors.length) {
              validations = validations.concat(
                errors.map((error) => ({
                  file,
                  message: error.message,
                }))
              );
            }
          }
        }
      }
      // if the PR has renovate files then we set a status no matter what
      let status: BranchStatus;
      let description: string;
      const topic = `Renovate Configuration Errors`;
      if (validations.length) {
        const content = validations
          .map((v) => `\`${v.file}\`: ${v.message}`)
          .join('\n\n');
        await platform.ensureComment({
          number: pr.number,
          topic,
          content,
        });
        status = BranchStatus.red;
        description = `Renovate config validation failed`; // GitHub limit
      } else {
        description = `Renovate config is valid`;
        status = BranchStatus.green;
        if (config.dryRun) {
          logger.info(
            `DRY-RUN: Would ensure validation comment removal in PR #${pr.number}`
          );
        } else {
          await platform.ensureCommentRemoval(pr.number, topic);
        }
      }
      // istanbul ignore else
      if (pr.sourceRepo === config.repository) {
        logger.debug({ status, description }, 'Setting PR validation status');
        const context = `renovate/validate`;
        if (config.dryRun) {
          logger.info(`DRY-RUN: Would set branch status in PR #${pr.number}`);
        } else {
          await platform.setBranchStatus({
            branchName: pr.branchName,
            context,
            description,
            state: status,
          });
        }
      } else {
        logger.debug('Skipping branch status for forked PR');
      }
    } catch (err) {
      // istanbul ignore if
      if (err.message === REPOSITORY_CHANGED) {
        logger.debug('Cannot access PR files to check them');
      } else {
        logger.warn(
          {
            err,
            prNo: pr.number,
            branchName: pr.branchName,
          },
          'Error checking PR'
        );
      }
    }
  }
}
