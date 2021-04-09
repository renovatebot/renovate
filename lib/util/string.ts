import { logger } from '../logger';

// Return true if the match string is found at index in content
export function matchAt(
  content: string,
  index: number,
  match: string
): boolean {
  return content.substring(index, index + match.length) === match;
}

// Replace oldString with newString at location index of content
export function replaceAt(
  content: string,
  index: number,
  oldString: string,
  newString: string
): string {
  logger.trace(`Replacing ${oldString} with ${newString} at index ${index}`);
  return (
    content.substr(0, index) +
    newString +
    content.substr(index + oldString.length)
  );
}
