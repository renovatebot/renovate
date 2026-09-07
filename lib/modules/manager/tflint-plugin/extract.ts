import { logger } from '../../../logger/index.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import type { ExtractionResult } from '../terraform/types.ts';
import { checkFileContainsDependency } from '../terraform/util.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import { extractTFLintPlugin } from './plugins.ts';
import { contentCheckList } from './util.ts';

const dependencyBlockExtractionRegex = regEx(
  /^\s*plugin\s+"(?<pluginName>[^"]+)"\s+{\s*$/,
);

export function extractPackageFile(
  content: string,
  packageFile: string,
  _config: ExtractConfig,
): PackageFileContent | null {
  logger.trace({ content }, `tflint.extractPackageFile(${packageFile})`);
  if (!checkFileContainsDependency(content, contentCheckList)) {
    logger.debug(
      { packageFile },
      'preflight content check has not found any relevant content',
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
          tfLintPlugin.groups.pluginName,
        );
        if (result) {
          lineNumber = result.lineNumber;
          deps = deps.concat(result.dependencies);
          result = null;
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err, packageFile }, 'Error extracting TFLint plugins');
  }

  return deps.length ? { deps } : null;
}
