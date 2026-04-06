import { isNullOrUndefined } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import type { UpdateDependencyConfig } from '../types.ts';

function versionFromQuotedAttribute(
  content: string,
  offset: number,
): { value: string; start: number; end: number } | null {
  const doubleQuoteStart = content.lastIndexOf('"', offset - 1);
  const singleQuoteStart = content.lastIndexOf("'", offset - 1);
  const quoteStart = Math.max(doubleQuoteStart, singleQuoteStart);
  if (quoteStart === -1) {
    return null;
  }

  const quote = content[quoteStart];
  /* v8 ignore next 3 -- quoteStart always points to a quote character */
  if (quote !== '"' && quote !== "'") {
    return null;
  }

  const end = content.indexOf(quote, offset);
  /* v8 ignore next 3 -- well-formed XML always has matching closing quote */
  if (end === -1) {
    return null;
  }

  const value = content.slice(quoteStart + 1, end);
  return { value, start: quoteStart + 1, end };
}

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const { currentValue, newValue, fileReplacePosition } = upgrade;

  if (isNullOrUndefined(fileReplacePosition)) {
    logger.debug('ant manager: missing fileReplacePosition');
    return null;
  }

  if (!newValue) {
    logger.debug('ant manager: missing newValue');
    return null;
  }

  const quotedAttribute = versionFromQuotedAttribute(
    fileContent,
    fileReplacePosition,
  );
  if (quotedAttribute) {
    if (quotedAttribute.value === newValue) {
      return fileContent;
    }

    if (quotedAttribute.value !== currentValue) {
      logger.debug(
        `ant manager: version mismatch at position ${fileReplacePosition}`,
      );
      return null;
    }

    return (
      fileContent.slice(0, quotedAttribute.start) +
      newValue +
      fileContent.slice(quotedAttribute.end)
    );
  }

  logger.debug('ant manager: could not detect version value');
  return null;
}
