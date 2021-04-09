import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import type { PackageFile } from '../../../../manager/types';
import { emojify } from '../../../../util/emoji';

export function getWarnings(config: RenovateConfig): string {
  if (!config.warnings.length) {
    return '';
  }
  let warningText = `\n# Warnings (${config.warnings.length})\n\n`;
  warningText += `Please correct - or verify that you can safely ignore - these warnings before you merge this PR.\n\n`;
  config.warnings.forEach((w) => {
    warningText += `-   \`${w.topic}\`: ${w.message}\n`;
  });
  warningText += '\n---\n';
  return warningText;
}

export function getErrors(config: RenovateConfig): string {
  let errorText = '';
  if (!config.errors.length) {
    return '';
  }
  errorText = `\n# Errors (${config.errors.length})\n\n`;
  errorText += `Renovate has found errors that you should fix (in this branch) before finishing this PR.\n\n`;
  config.errors.forEach((e) => {
    errorText += `-   \`${e.topic}\`: ${e.message}\n`;
  });
  errorText += '\n---\n';
  return errorText;
}

export function getDepWarnings(
  packageFiles: Record<string, PackageFile[]>
): string {
  let warningText = '';
  try {
    const warnings: string[] = [];
    const warningFiles: string[] = [];
    for (const files of Object.values(packageFiles || {})) {
      for (const file of files || []) {
        if (file.deps) {
          for (const dep of file.deps || []) {
            if (dep.warnings?.length) {
              const message = dep.warnings[0].message;
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
    warnings.forEach((w) => {
      warningText += `-   \`${w}\`\n`;
    });
    warningText +=
      '\nFiles affected: ' +
      warningFiles.map((f) => '`' + f + '`').join(', ') +
      '\n\n';
  } catch (err) {
    // istanbul ignore next
    logger.error({ err }, 'Error generating dep warnings text');
  }
  return warningText;
}
