import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import type { PackageDependency } from '../types';
import type { ExtractionResult, TFLintManagerData } from './types';
import { keyValueExtractionRegex } from './util';

export function extractTFLintPlugin(
  startingLine: number,
  lines: string[],
  pluginName: string
): ExtractionResult {
  let lineNumber = startingLine;
  const deps: PackageDependency<TFLintManagerData>[] = [];
  const dep: PackageDependency<TFLintManagerData> = {
    managerData: {
      pluginName: pluginName,
    },
  };

  let braceCounter = 0;
  do {
    // istanbul ignore if
    if (lineNumber > lines.length - 1) {
      logger.debug(`Malformed TFLint configuration file detected.`);
    }

    const line = lines[lineNumber];

    // istanbul ignore else
    if (is.string(line)) {
      // `{` will be counted with +1 and `}` with -1.
      // Therefore if we reach braceCounter == 0.
      // We have found the end of the tflint configuration block
      const openBrackets = (line.match(regEx(/\{/g)) ?? []).length;
      const closedBrackets = (line.match(regEx(/\}/g)) ?? []).length;
      braceCounter = braceCounter + openBrackets - closedBrackets;

      // only update fields inside the root block
      if (braceCounter === 1) {
        const kvMatch = keyValueExtractionRegex.exec(line);
        if (kvMatch?.groups) {
          if (kvMatch.groups.key === 'version') {
            dep.currentValue = kvMatch.groups.value;
          } else if (kvMatch.groups.key === 'source') {
            // TODO #7154
            dep.managerData!.source = kvMatch.groups.value;
            dep.managerData!.sourceLine = lineNumber;
          }
        }
      }
    } else {
      // stop - something went wrong
      braceCounter = 0;
    }
    lineNumber += 1;
  } while (braceCounter !== 0);
  deps.push(dep);

  // remove last lineNumber addition to not skip a line after the last bracket
  lineNumber -= 1;
  return { lineNumber, dependencies: deps };
}

export function analyseTFLintPlugin(dep: PackageDependency): void {
  // TODO #7154
  const source = dep.managerData!.source as string;
  if (source) {
    dep.depType = 'plugin';

    const sourceParts = source.split('/');
    if (sourceParts[0] === 'github.com') {
      dep.datasource = GithubReleasesDatasource.id;
      dep.depName = sourceParts.slice(1).join('/');
    } else {
      dep.skipReason = 'unsupported-datasource';
      dep.depName = source;
    }
  } else {
    logger.debug({ dep }, 'tflint plugin has no source');
    dep.skipReason = 'no-source';
  }
}
