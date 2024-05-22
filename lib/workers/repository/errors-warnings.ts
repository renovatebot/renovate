// TODO #22198
import is from '@sindresorhus/is';
import type { RenovateConfig } from '../../config/types';
import { logger } from '../../logger';
import type { PackageFile } from '../../modules/manager/types';
import { coerceArray } from '../../util/array';
import { emojify } from '../../util/emoji';
import { regEx } from '../../util/regex';
import type { DepWarnings } from '../types';
import { extractRepoProblems } from './common';

export function getWarnings(config: RenovateConfig): string {
  if (!config.warnings?.length) {
    return '';
  }
  let warningText = `\n# Warnings (${config.warnings.length})\n\n`;
  warningText += `Please correct - or verify that you can safely ignore - these warnings before you merge this PR.\n\n`;
  for (const w of config.warnings) {
    warningText += `-   \`${w.topic}\`: ${w.message}\n`;
  }
  warningText += '\n---\n';
  return warningText;
}

export function getErrors(config: RenovateConfig): string {
  if (!config.errors?.length) {
    return '';
  }
  let errorText = `\n# Errors (${config.errors.length})\n\n`;
  errorText += `Renovate has found errors that you should fix (in this branch) before finishing this PR.\n\n`;
  for (const e of config.errors) {
    errorText += `-   \`${e.topic}\`: ${e.message}\n`;
  }
  errorText += '\n---\n';
  return errorText;
}

function getDepWarnings(
  packageFiles: Record<string, PackageFile[]>,
): DepWarnings {
  const warnings: string[] = [];
  const warningFiles: string[] = [];
  for (const files of Object.values(packageFiles ?? {})) {
    for (const file of files ?? []) {
      // TODO: remove condition when type is fixed (#22198)
      if (file.packageFile) {
        for (const dep of coerceArray(file.deps)) {
          for (const w of coerceArray(dep.warnings)) {
            const message = w.message;
            if (!warnings.includes(message)) {
              warnings.push(message);
            }
            if (!warningFiles.includes(file.packageFile)) {
              warningFiles.push(file.packageFile);
            }
          }
        }
      }
    }
  }
  if (warnings.length) {
    logger.warn({ warnings, files: warningFiles }, 'Package lookup failures');
  }
  return { warnings, warningFiles };
}

export function getDepWarningsOnboardingPR(
  packageFiles: Record<string, PackageFile[]>,
  config: RenovateConfig,
): string {
  const { warnings, warningFiles } = getDepWarnings(packageFiles);
  if (config.suppressNotifications?.includes('dependencyLookupWarnings')) {
    return '';
  }
  let warningText = '';
  if (!warnings.length) {
    return '';
  }
  warningText = emojify(`\n---\n> \n> :warning: **Warning**\n> \n`);
  warningText += `> Please correct - or verify that you can safely ignore - these dependency lookup failures before you merge this PR.\n> \n`;
  for (const w of warnings) {
    warningText += `> -   \`${w}\`\n`;
  }
  warningText +=
    '> \n> Files affected: ' +
    warningFiles.map((f) => '`' + f + '`').join(', ') +
    '\n\n';
  return warningText;
}

export function getPrWarnings(
  config: RenovateConfig,
  packageFiles?: Record<string, PackageFile[]>,
  dependencyDashboard?: boolean,
): string {
  const warningLines = [];
  if (packageFiles) {
    const { warnings } = getDepWarnings(packageFiles);
    if (
      !config.suppressNotifications?.includes('dependencyLookupWarnings') &&
      warnings.length
    ) {
      const msg = '> Some dependencies could not be looked up. ';
      if (dependencyDashboard) {
        warningLines.push(
          msg + 'Check the Dependency Dashboard for more information.',
        );
      } else {
        warningLines.push(msg + 'Check the warning logs for more information.');
      }
    }
  }

  if (config.repository) {
    const repoProblems = extractRepoProblems(config.repository);
    for (const entry of repoProblems) {
      if (entry.startsWith('WARN:')) {
        warningLines.push(
          '> Warnings were raised. Check the logs or Dashboard for more information.',
        );
        break;
      }
    }
  }

  let warningText = '';
  if (is.nonEmptyArray(warningLines)) {
    warningText += emojify(`\n---\n\n> :warning: **Warning**\n> \n`);
    warningText += warningLines.join('\n\n');
  }
  return warningText;
}

export function getDepWarningsDashboard(
  packageFiles: Record<string, PackageFile[]>,
  config: RenovateConfig,
): string {
  if (config.suppressNotifications?.includes('dependencyLookupWarnings')) {
    return '';
  }
  const { warnings, warningFiles } = getDepWarnings(packageFiles);
  if (!warnings.length) {
    return '';
  }

  const depWarnings = warnings
    .map((w) =>
      w.replace(regEx(/^Failed to look up(?: [-\w]+)? dependency /), ''),
    )
    .map((dep) => '`' + dep + '`')
    .join(', ');

  let warningText = emojify(
    `\n---\n\n> :warning: **Warning**\n> \n> Renovate failed to look up the following dependencies: `,
  );
  warningText += depWarnings;
  warningText += '.\n> \n> Files affected: ';
  warningText += warningFiles.map((f) => '`' + f + '`').join(', ');
  warningText += '\n\n---\n\n';
  return warningText;
}
