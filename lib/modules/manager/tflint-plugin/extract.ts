import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { extractTFLintPlugin } from './plugins';
import type { ExtractionResult } from './types';
import { checkFileContainsPlugins } from './util';

const dependencyBlockExtractionRegex = regEx(
  /^\s*plugin\s+"(?<pluginName>[^"]+)"\s+{\s*$/
);

export function extractPackageFile(
  content: string,
  fileName: string,
  config: ExtractConfig
): PackageFileContent | null {
  logger.trace({ content }, 'tflint.extractPackageFile()');
  if (!checkFileContainsPlugins(content)) {
    logger.trace(
      { fileName },
      'preflight content check has not found any relevant content'
    );
    return null;
  }

  let deps: PackageDependency[] = [];

  try {
    const lines = content.split(newlineRegex);

    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];
      const tfLintPlugin = dependencyBlockExtractionRegex.exec(line);
      if (tfLintPlugin?.groups) {
        logger.trace(`Matched TFLint plugin on line ${lineNumber}`);
        let result: ExtractionResult | null = null;
        result = extractTFLintPlugin(
          lineNumber,
          lines,
          tfLintPlugin.groups.pluginName
        );
        if (result) {
          lineNumber = result.lineNumber;
          deps = deps.concat(result.dependencies);
          result = null;
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting TFLint plugins');
  }

  return deps.length ? { deps } : null;
}
