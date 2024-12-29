import is from '@sindresorhus/is';
import { logger } from '../../logger';
import type {
  RegexManagerConfig,
  RegexManagerTemplates,
} from '../../modules/manager/custom/regex/types';
import { regEx } from '../../util/regex';
import type { ValidationMessage } from '../types';

export function getParentName(parentPath: string | undefined): string {
  return parentPath
    ? parentPath
        .replace(regEx(/\.?encrypted$/), '')
        .replace(regEx(/\[\d+\]$/), '')
        .split('.')
        .pop()!
    : '.';
}

export function validatePlainObject(
  val: Record<string, unknown>,
): true | string {
  for (const [key, value] of Object.entries(val)) {
    if (!is.string(value)) {
      return key;
    }
  }
  return true;
}

export function validateNumber(
  key: string,
  val: unknown,
  allowsNegative: boolean,
  currentPath?: string,
  subKey?: string,
): ValidationMessage[] {
  const errors: ValidationMessage[] = [];
  const path = `${currentPath}${subKey ? '.' + subKey : ''}`;
  if (is.number(val)) {
    if (val < 0 && !allowsNegative) {
      errors.push({
        topic: 'Configuration Error',
        message: `Configuration option \`${path}\` should be a positive integer. Found negative value instead.`,
      });
    }
  } else {
    errors.push({
      topic: 'Configuration Error',
      message: `Configuration option \`${path}\` should be an integer. Found: ${JSON.stringify(
        val,
      )} (${typeof val}).`,
    });
  }

  return errors;
}

/**  An option is a false global if it has the same name as a global only option
 *   but is actually just the field of a non global option or field an children of the non global option
 *   eg. token: it's global option used as the bot's token as well and
 *   also it can be the token used for a platform inside the hostRules configuration
 */
export function isFalseGlobal(
  optionName: string,
  parentPath?: string,
): boolean {
  if (parentPath?.includes('hostRules')) {
    if (
      optionName === 'token' ||
      optionName === 'username' ||
      optionName === 'password'
    ) {
      return true;
    }
  }

  return false;
}

function hasField(
  customManager: Partial<RegexManagerConfig>,
  field: string,
): boolean {
  const templateField = `${field}Template` as keyof RegexManagerTemplates;
  return !!(
    customManager[templateField] ??
    customManager.matchStrings?.some((matchString) =>
      matchString.includes(`(?<${field}>`),
    )
  );
}

export function validateRegexManagerFields(
  customManager: Partial<RegexManagerConfig>,
  currentPath: string,
  errors: ValidationMessage[],
): void {
  if (is.nonEmptyArray(customManager.matchStrings)) {
    for (const matchString of customManager.matchStrings) {
      try {
        regEx(matchString);
      } catch (err) {
        logger.debug(
          { err },
          'customManager.matchStrings regEx validation error',
        );
        errors.push({
          topic: 'Configuration Error',
          message: `Invalid regExp for ${currentPath}: \`${matchString}\``,
        });
      }
    }
  } else {
    errors.push({
      topic: 'Configuration Error',
      message: `Each Custom Manager must contain a non-empty matchStrings array`,
    });
  }

  const mandatoryFields = ['currentValue', 'datasource'];
  for (const field of mandatoryFields) {
    if (!hasField(customManager, field)) {
      errors.push({
        topic: 'Configuration Error',
        message: `Regex Managers must contain ${field}Template configuration or regex group named ${field}`,
      });
    }
  }

  const nameFields = ['depName', 'packageName'];
  if (!nameFields.some((field) => hasField(customManager, field))) {
    errors.push({
      topic: 'Configuration Error',
      message: `Regex Managers must contain depName or packageName regex groups or templates`,
    });
  }
}
