import { GlobalConfig } from '../config/global.ts';
import { logger } from '../logger/index.ts';
import { hiddenUnicodeCharactersRegex, toUnicodeEscape } from './regex.ts';

function isBinaryContent(content: Buffer): boolean {
  // Check for null bytes in the first 8KB - a common indicator of binary content
  const sampleSize = Math.min(content.length, 8192);
  for (let i = 0; i < sampleSize; i++) {
    if (content[i] === 0) {
      return true;
    }
  }
  return false;
}

function filterAllowedCharacters(
  characters: string[],
  allowedCharacters?: string[],
): string[] {
  if (!allowedCharacters || allowedCharacters.length === 0) {
    return characters;
  }

  // Convert allowed characters from \uXXXX format to actual characters
  const allowedSet = new Set(
    allowedCharacters.map((code) => {
      // Handle \uXXXX format
      if (code.startsWith('\\u')) {
        const hex = code.slice(2);
        return String.fromCharCode(parseInt(hex, 16));
      }
      // Handle U+XXXX format
      if (code.toUpperCase().startsWith('U+')) {
        const hex = code.slice(2);
        return String.fromCharCode(parseInt(hex, 16));
      }
      // Handle raw character
      return code;
    }),
  );

  return characters.filter((char) => !allowedSet.has(char));
}

export function logWarningIfUnicodeHiddenCharactersInPackageFile(
  file: string,
  content: string | Buffer,
  ignoreHiddenUnicodeCharacters?: string[],
): void {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const hiddenCharacters = buffer
    .toString('utf8')
    .match(hiddenUnicodeCharactersRegex);

  if (isBinaryContent(buffer) && hiddenCharacters) {
    logger.trace(
      {
        file,
        hiddenCharacters: toUnicodeEscape(hiddenCharacters.join('')),
      },

      `Hidden Unicode characters discovered in file \`${file}\`, but not logging higher than TRACE as it appears to be a binary file`,
    );
    return;
  }

  if (hiddenCharacters) {
    // Use provided ignoreHiddenUnicodeCharacters, or fall back to GlobalConfig
    logger.info({ ignoreHiddenUnicodeCharacters }, 'JVT B');
    const allowedChars =
      ignoreHiddenUnicodeCharacters ??
      GlobalConfig.get('ignoreHiddenUnicodeCharacters');
    logger.info({ ignoreHiddenUnicodeCharacters }, 'JVT A');

    // Filter out allowed characters
    const filteredCharacters = filterAllowedCharacters(
      hiddenCharacters,
      allowedChars,
    );

    if (filteredCharacters.length === 0) {
      return;
    }

    if (filteredCharacters.length === 1 && filteredCharacters[0] === '\uFEFF') {
      logger.once.trace(
        {
          file,
          hiddenCharacters: toUnicodeEscape(filteredCharacters.join('')),
        },
        `Hidden Byte Order Mark (BOM) Unicode characters has been discovered in the file \`${file}\`. This is likely safe, if you are using Microsoft Windows, but please confirm that they are intended to be there, as they could be an attempt to "smuggle" text into your codebase, or used to confuse tools like Renovate or Large Language Models (LLMs)`,
      );
    } else {
      logger.once.warn(
        {
          file,
          hiddenCharacters: toUnicodeEscape(filteredCharacters.join('')),
        },
        `Hidden Unicode characters have been discovered in file(s) in your repository. See your Renovate logs for more details. Please confirm that they are intended to be there, as they could be an attempt to "smuggle" text into your codebase, or used to confuse tools like Renovate or Large Language Models (LLMs)`,
      );
    }
  }
}
