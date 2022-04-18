import type { RenovateConfig } from '../../../../config/types';

export function getWarnings(config: RenovateConfig): string {
  if (!config?.warnings?.length) {
    return '';
  }
  let warningText = `\n# Warnings (${config?.warnings.length})\n\n`;
  warningText += `Please correct - or verify that you can safely ignore - these warnings before you merge this PR.\n\n`;
  config?.warnings.forEach((w) => {
    warningText += `-   \`${w.topic}\`: ${w.message}\n`;
  });
  warningText += '\n---\n';
  return warningText;
}

export function getErrors(config: RenovateConfig): string {
  let errorText = '';
  if (!config?.errors?.length) {
    return '';
  }
  errorText = `\n# Errors (${config?.errors.length})\n\n`;
  errorText += `Renovate has found errors that you should fix (in this branch) before finishing this PR.\n\n`;
  config?.errors.forEach((e) => {
    errorText += `-   \`${e.topic}\`: ${e.message}\n`;
  });
  errorText += '\n---\n';
  return errorText;
}
