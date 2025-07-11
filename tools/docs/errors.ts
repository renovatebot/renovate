import { LOG_CODES } from '../../lib/logger/error-codes';
import { readFile, updateFile } from '../utils';
export async function generateErrors(dist: string): Promise<void> {
  const errorFile = 'errors.md';
  let errorFileContents = await readFile(`docs/usage/${errorFile}`);
  const errorTypes = ['fatal'] as const;
  for (const errorType of errorTypes) {
    const capitalizedType =
      errorType.charAt(0).toUpperCase() + errorType.slice(1);
    errorFileContents += `\n\n## ${capitalizedType} Errors\n\n`;
    for (const [
      code,
      { message, description, additionalFields },
    ] of Object.entries(LOG_CODES.fatal)) {
      errorFileContents += `### ${code}\n\n`;
      errorFileContents += `**Message:** ${message}\n\n`;
      if (description) {
        errorFileContents += `**Description:** ${description}\n\n`;
      }
      if (additionalFields) {
        errorFileContents += `**Additional Fields:**\n\n`;
        for (const [field, type] of Object.entries(additionalFields)) {
          errorFileContents += `- \`${field}\`: \`${type}\`\n`;
        }
        errorFileContents += '\n';
      }
    }
    errorFileContents += '\n';
  }
  await updateFile(`${dist}/${errorFile}`, errorFileContents);
}
