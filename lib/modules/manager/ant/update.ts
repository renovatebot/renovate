import { logger } from '../../../logger/index.ts';
import type { UpdateDependencyConfig } from '../types.ts';

/** For external .properties files: updateDependency is necessary because extractPackageFile can't reconstruct dep metadata from a .properties file alone */
export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const { depName, currentValue, newValue, fileReplacePosition } = upgrade;

  if (fileReplacePosition === undefined || fileReplacePosition === null) {
    logger.debug({ depName }, 'No fileReplacePosition for ant dependency');
    return null;
  }

  const leftPart = fileContent.slice(0, fileReplacePosition);
  const rightPart = fileContent.slice(fileReplacePosition);

  // Find the end of the value (closing quote or end of line for .properties files)
  let endIndex: number;
  const quoteChar = leftPart.at(-1);
  if (quoteChar === '"' || quoteChar === "'") {
    endIndex = rightPart.indexOf(quoteChar);
  } else {
    // Could be a .properties file or a substring inside a coords attribute
    const newlineIndex = rightPart.indexOf('\n');
    const lineEnd = newlineIndex === -1 ? rightPart.length : newlineIndex;

    // Check for closing quote before newline (indicates coords attribute)
    const nearestQuote = [
      rightPart.indexOf('"'),
      rightPart.indexOf("'"),
    ].filter((i) => i !== -1 && i < lineEnd);

    if (nearestQuote.length > 0) {
      // Inside a quoted attribute (coords) - version ends at : or closing quote
      const quoteEnd = Math.min(...nearestQuote);
      const colonIndex = rightPart.indexOf(':');
      endIndex =
        colonIndex !== -1 && colonIndex < quoteEnd ? colonIndex : quoteEnd;
    } else {
      // .properties file: value ends at newline or EOF
      endIndex = lineEnd;
    }
  }

  const currentFound = rightPart.slice(0, endIndex);

  if (currentFound === newValue) {
    return fileContent;
  }

  if (currentFound === currentValue || upgrade.sharedVariableName) {
    return `${leftPart}${newValue}${rightPart.slice(endIndex)}`;
  }

  logger.debug(
    { depName, currentFound, currentValue, newValue },
    'ant: unexpected value at fileReplacePosition',
  );
  return null;
}
