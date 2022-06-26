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
      if (file.deps) {
        for (const dep of file.deps ?? []) {
          if (dep.warnings?.length) {
            for (const w of dep.warnings) {
              const message = w.message;
              if (!warnings.includes(message)) {
                warnings.push(message);
              }
              if (
                file.packageFile &&
                !warningFiles.includes(file.packageFile)
              ) {
                warningFiles.push(file.packageFile);
              }
            }
          }
        }
      }
    }
  }
  return { warnings, warningFiles };
}

export function getDepWarningsPR(
  packageFiles: Record<string, PackageFile[]>
): string {
  const { warnings, warningFiles } = getDepWarnings(packageFiles);
  let warningText = '';
  if (!warnings.length) {
    return '';
  }
  logger.debug(
    { warnings, warningFiles },
    'Found package lookup warnings in onboarding'
  );
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
