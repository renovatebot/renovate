import jsonValidator from 'json-dup-key-validator';
import JSON5 from 'json5';
import upath from 'upath';
import { logger } from '../logger';
import { parseJson } from '../util/common';

export function parseFileConfig(
  fileName: string,
  fileContents: string,
):
  | { success: true; parsedContents: unknown }
  | { success: false; validationError: string; validationMessage: string } {
  const fileType = upath.extname(fileName);

  if (fileType === '.json5') {
    try {
      return { success: true, parsedContents: JSON5.parse(fileContents) };
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ fileName, fileContents }, 'Error parsing JSON5 file');
      const validationError = 'Invalid JSON5 (parsing failed)';
      const validationMessage = `JSON5.parse error: \`${err.message.replaceAll(
        '`',
        "'",
      )}\``;
      return {
        success: false,
        validationError,
        validationMessage,
      };
    }
  } else {
    let allowDuplicateKeys = true;
    let jsonValidationError = jsonValidator.validate(
      fileContents,
      allowDuplicateKeys,
    );
    if (jsonValidationError) {
      const validationError = 'Invalid JSON (parsing failed)';
      const validationMessage = jsonValidationError;
      return {
        success: false,
        validationError,
        validationMessage,
      };
    }
    allowDuplicateKeys = false;
    jsonValidationError = jsonValidator.validate(
      fileContents,
      allowDuplicateKeys,
    );
    if (jsonValidationError) {
      const validationError = 'Duplicate keys in JSON';
      const validationMessage = JSON.stringify(jsonValidationError);
      return {
        success: false,
        validationError,
        validationMessage,
      };
    }
    try {
      return {
        success: true,
        parsedContents: parseJson(fileContents, fileName),
      };
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ fileContents }, 'Error parsing renovate config');
      const validationError = 'Invalid JSON (parsing failed)';
      const validationMessage = `JSON.parse error:  \`${err.message.replaceAll(
        '`',
        "'",
      )}\``;
      return { success: false, validationError, validationMessage };
    }
  }
}
