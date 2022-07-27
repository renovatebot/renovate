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
    content.substring(0, index) +
    newString +
    content.substring(index + oldString.length)
  );
}

/**
 * Converts from utf-8 string to base64-encoded string
 */
export function toBase64(input: string): string {
  return Buffer.from(input).toString('base64');
}

/**
 * Converts from base64-encoded string to utf-8 string
 */
export function fromBase64(input: string): string {
  return Buffer.from(input, 'base64').toString();
}

export function uniqueStrings(
  element: string,
  index: number,
  elements: string[]
): boolean {
  return elements.indexOf(element) === index;
}
