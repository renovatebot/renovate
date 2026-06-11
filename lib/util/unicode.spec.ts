import { logger } from '~test/util.ts';
import { logWarningIfUnicodeHiddenCharactersInPackageFile } from './unicode.ts';

describe('util/unicode', () => {
  describe('logWarningIfUnicodeHiddenCharactersInPackageFile', () => {
    it('logs a warning for hidden Unicode characters in text files', () => {
      const content = 'some\u00A0content\u200Bfoo';
      logWarningIfUnicodeHiddenCharactersInPackageFile('file.txt', content);

      expect(logger.logger.once.warn).toHaveBeenCalledWith(
        { file: 'file.txt', hiddenCharacters: '\\u00A0\\u200B' },
        `Hidden Unicode characters have been discovered in file(s) in your repository. See your Renovate logs for more details. Please confirm that they are intended to be there, as they could be an attempt to "smuggle" text into your codebase, or used to confuse tools like Renovate or Large Language Models (LLMs)`,
      );
    });

    it('logs a trace message for BOM character only', () => {
      const content = '\uFEFF<Project Sdk="Microsoft.NET.Sdk">';
      logWarningIfUnicodeHiddenCharactersInPackageFile(
        'example.csproj',
        content,
      );

      expect(logger.logger.once.warn).toHaveBeenCalledTimes(0);
      expect(logger.logger.once.trace).toHaveBeenCalledWith(
        { file: 'example.csproj', hiddenCharacters: '\\uFEFF' },
        'Hidden Byte Order Mark (BOM) Unicode characters has been discovered in the file `example.csproj`. This is likely safe, if you are using Microsoft Windows, but please confirm that they are intended to be there, as they could be an attempt to "smuggle" text into your codebase, or used to confuse tools like Renovate or Large Language Models (LLMs)',
      );
    });

    it('does not log a warning for binary files with null bytes but no hidden unicode', () => {
      const binaryContent = Buffer.from([
        0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00, 0x74, 0x65, 0x78, 0x74,
      ]);
      logWarningIfUnicodeHiddenCharactersInPackageFile(
        'binary.zip',
        binaryContent,
      );

      expect(logger.logger.once.warn).toHaveBeenCalledTimes(0);
      expect(logger.logger.trace).toHaveBeenCalledTimes(0);
    });

    it('logs a trace message (not warning) for binary files with hidden unicode characters', () => {
      // Binary file with null byte (making it binary) followed by 0x200B (zero-width space)
      const binaryContent = Buffer.from([
        0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0xe2, 0x80, 0x8b, 0x74, 0x65, 0x78,
      ]); // 0xe2 0x80 0x8b is UTF-8 encoding of U+200B (zero-width space)
      logWarningIfUnicodeHiddenCharactersInPackageFile(
        'binary.dat',
        binaryContent,
      );

      expect(logger.logger.once.warn).toHaveBeenCalledTimes(0);
      expect(logger.logger.trace).toHaveBeenCalledWith(
        {
          file: 'binary.dat',
          hiddenCharacters: expect.stringContaining('\\u200B'),
        },
        'Hidden Unicode characters discovered in file `binary.dat`, but not logging higher than TRACE as it appears to be a binary file',
      );
    });

    it('does not log a warning when no hidden characters are present', () => {
      const content = 'normal text content';
      logWarningIfUnicodeHiddenCharactersInPackageFile('file.txt', content);

      expect(logger.logger.once.warn).toHaveBeenCalledTimes(0);
      expect(logger.logger.once.trace).toHaveBeenCalledTimes(0);
    });
  });
});
