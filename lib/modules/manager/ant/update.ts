import { logger } from '../../../logger/index.ts';
import type { UpdateDependencyConfig } from '../types.ts';

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
    // .properties file: value ends at newline or EOF
    const newlineIndex = rightPart.indexOf('\n');
    endIndex = newlineIndex === -1 ? rightPart.length : newlineIndex;
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
