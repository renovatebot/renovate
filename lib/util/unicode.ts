import { logger } from '../logger/index.ts';
import { hiddenUnicodeCharactersRegex, toUnicodeEscape } from './regex.ts';

export function logWarningIfUnicodeHiddenCharactersInPackageFile(
  file: string,
  content: string | Buffer,
): void {
  const hiddenCharacters = content
    .toString('utf8')
    .match(hiddenUnicodeCharactersRegex);
  if (hiddenCharacters) {
    logger.once.warn(
      {
        file,
        hiddenCharacters: toUnicodeEscape(hiddenCharacters.join('')),
      },
      `Hidden Unicode characters have been discovered in the file \`${file}\`. Please confirm that they are intended to be there, as they could be an attempt to "smuggle" text into your codebase, or used to confuse tools like Renovate or Large Language Models (LLMs)`,
    );
  }
}
