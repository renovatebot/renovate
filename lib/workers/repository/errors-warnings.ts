// TODO #7154
import type { RenovateConfig } from '../../config/types';
import { logger } from '../../logger';
import type { PackageFile } from '../../modules/manager/types';
import { emojify } from '../../util/emoji';
import type { DepWarnings } from '../types';

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
  packageFiles: Record<string, PackageFile[]>
): DepWarnings {
  const warnings: string[] = [];
  const warningFiles: string[] = [];
  for (const files of Object.values(packageFiles ?? {})) {
    for (const file of files ?? []) {
      // TODO: remove condition when type is fixed (#7154)
      if (file.packageFile) {
        for (const dep of file.deps ?? []) {
          for (const w of dep.warnings ?? []) {
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
  return { warnings, warningFiles };
}

export function getDepWarningsOnboardingPR(
  packageFiles: Record<string, PackageFile[]>
): string {
  const { warnings, warningFiles } = getDepWarnings(packageFiles);
  let warningText = '';
  if (!warnings.length) {
    return '';
  }
  logger.debug({ warnings, warningFiles }, 'Found package lookup warnings');
  warningText = emojify(
    `\n---\n\n### :warning: Dependency Lookup Warnings :warning:\n\n`
  );
  warningText += `Please correct - or verify that you can safely ignore - these lookup failures before you merge this PR.\n\n`;
  for (const w of warnings) {
    warningText += `-   \`${w}\`\n`;
  }
  warningText +=
    '\nFiles affected: ' +
    warningFiles.map((f) => '`' + f + '`').join(', ') +
    '\n\n';
  return warningText;
}

export function getDepWarningsPR(
  packageFiles: Record<string, PackageFile[]>,
  dependencyDashboard?: boolean
): string {
  const { warnings, warningFiles } = getDepWarnings(packageFiles);
  let warningText = '';
  if (!warnings.length) {
    return '';
  }
  logger.debug({ warnings, warningFiles }, 'Found package lookup warnings');
  warningText = emojify(
    `\n---\n\n### :warning: Dependency Lookup Warnings :warning:\n\n`
  );
  warningText += 'Warnings were logged while processing this repo. ';
  if (dependencyDashboard) {
    warningText += `Please check the Dependency Dashboard for more information.\n\n`;
  } else {
    warningText += `Please check the logs for more information.\n\n`;
  }
  return warningText;
}

export function getDepWarningsDashboard(
  packageFiles: Record<string, PackageFile[]>
): string {
  const { warnings, warningFiles } = getDepWarnings(packageFiles);
  if (!warnings.length) {
    return '';
  }

  const depWarnings = warnings
    .map((w) => w.replace('Failed to look up dependency ', ''))
    .map((dep) => '`' + dep + '`')
    .join(', ');

  logger.debug({ warnings, warningFiles }, 'Found package lookup warnings');
  let warningText = emojify(
    `\n---\n\n### :warning: Dependency Lookup Warnings :warning:\n\n`
  );
  warningText += `-   Renovate failed to look up the following dependencies: `;
  warningText += depWarnings;
  warningText += '.\n\nFiles affected: ';
  warningText += warningFiles.map((f) => '`' + f + '`').join(', ');
  warningText += '\n\n---\n\n';
  return warningText;
}
