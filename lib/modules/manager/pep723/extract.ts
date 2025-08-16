import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import type { PackageFileContent } from '../types';
import { Pep723 } from './schema';

// Adapted regex from the Python reference implementation: https://packaging.python.org/en/latest/specifications/inline-script-metadata/#reference-implementation
const regex = regEx(
  /^# \/\/\/ (?<type>[a-zA-Z0-9-]+)$\s(?<content>(^#(| .*)$\s)+)^# \/\/\/$/,
  'm',
);

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  const match = regex.exec(content);
  const matchedContent = match?.groups?.content;

  if (!matchedContent) {
    return null;
  }

  // Adapted code from the Python reference implementation: https://packaging.python.org/en/latest/specifications/inline-script-metadata/#reference-implementation
  const parsedToml = matchedContent
    .split(newlineRegex)
    .map((line) => line.substring(line.startsWith('# ') ? 2 : 1))
    .join('\n');

  const { data: res, error } = Pep723.safeParse(parsedToml);

  if (error) {
    logger.debug(
      { packageFile, error },
      `Error parsing PEP 723 inline script metadata`,
    );
    return null;
  }

  return res.deps.length ? res : null;
}
