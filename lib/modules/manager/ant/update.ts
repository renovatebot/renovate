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

function versionFromPropertiesContent(
  content: string,
  offset: number,
): { value: string; start: number; end: number } | null {
  let end = content.indexOf('\n', offset);
  if (end === -1) {
    end = content.length;
  }
  const value = content.slice(offset, end).trim();
  if (!value) {
    return null;
  }
  return { value, start: offset, end: offset + value.length };
}

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const { currentValue, newValue, fileReplacePosition } = upgrade;

  if (fileReplacePosition === undefined || fileReplacePosition === null) {
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
    if (quotedAttribute.value === currentValue) {
      if (currentValue === newValue) {
        return fileContent;
      }
      return (
        fileContent.slice(0, quotedAttribute.start) +
        newValue +
        fileContent.slice(quotedAttribute.end)
      );
    }

    if (currentValue && quotedAttribute.value.includes(currentValue)) {
      /* v8 ignore next 3 -- coords value already contains newValue */
      if (quotedAttribute.value.includes(newValue)) {
        return fileContent;
      }
      const replacedValue = quotedAttribute.value.replace(
        currentValue,
        newValue,
      );
      return (
        fileContent.slice(0, quotedAttribute.start) +
        replacedValue +
        fileContent.slice(quotedAttribute.end)
      );
    }

    logger.debug(
      `ant manager: version mismatch at position ${fileReplacePosition}`,
    );
    return null;
  }

  const propertiesValue = versionFromPropertiesContent(
    fileContent,
    fileReplacePosition,
  );
  if (propertiesValue) {
    if (propertiesValue.value === newValue) {
      return fileContent;
    }

    if (propertiesValue.value !== currentValue && !upgrade.sharedVariableName) {
      logger.debug(
        `ant manager: properties value mismatch at position ${fileReplacePosition}`,
      );
      return null;
    }

    return (
      fileContent.slice(0, propertiesValue.start) +
      newValue +
      fileContent.slice(propertiesValue.end)
    );
  }

  logger.debug('ant manager: could not detect version value');
  return null;
}
