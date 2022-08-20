import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import { getDep } from '../dockerfile/extract';
import type { ExtractConfig, PackageFile } from '../types';
import type { WoodpeckerConfig } from './types';

class LineMapper {
  private imageLines: { line: string; lineNumber: number; used: boolean }[];

  constructor(content: string, filter: RegExp) {
    this.imageLines = [...content.split(newlineRegex).entries()]
      .filter((entry) => filter.test(entry[1]))
      .map(([lineNumber, line]) => ({ lineNumber, line, used: false }));
  }

  pluckLineNumber(imageName: string | undefined): number | null {
    const lineMeta = this.imageLines.find(
      ({ line, used }) => !used && imageName && line.includes(imageName)
    );
    // istanbul ignore if
    if (!lineMeta) {
      return null;
    }
    lineMeta.used = true; // unset plucked lines so duplicates are skipped
    return lineMeta.lineNumber;
  }
}

export function extractPackageFile(
  content: string,
  fileName: string,
  extractConfig: ExtractConfig
): PackageFile | null {
  logger.debug('woodpecker.extractPackageFile()');
  let config: WoodpeckerConfig;
  try {
    // TODO: fix me (#9610)
    config = load(content, { json: true }) as WoodpeckerConfig;
    if (!config) {
      logger.debug(
        { fileName },
        'Null config when parsing Woodpecker Configuration content'
      );
      return null;
    }
    if (typeof config !== 'object') {
      logger.debug(
        { fileName, type: typeof config },
        'Unexpected type for Woodpecker Configuration content'
      );
      return null;
    }
  } catch (err) {
    logger.debug({ err }, 'err');
    logger.debug({ fileName }, 'Parsing Woodpecker Configuration config YAML');
    return null;
  }
  try {
    const lineMapper = new LineMapper(content, regEx(/^\s*image:/));

    // Image name/tags for services are only eligible for update if they don't
    // use variables and if the image is not built locally
    const deps = Object.values(config.pipeline ?? {})
      .filter((step) => is.string(step?.image))
      .map((step) => {
        const dep = getDep(step.image, true, extractConfig.registryAliases);
        const lineNumber = lineMapper.pluckLineNumber(step.image);
        // istanbul ignore if
        if (!lineNumber) {
          return null;
        }
        return dep;
      })
      .filter(is.truthy);

    logger.trace({ deps }, 'Woodpecker Configuration image');
    return { deps };
  } catch (err) /* istanbul ignore next */ {
    logger.warn(
      { fileName, content, err },
      'Error extracting Woodpecker Configuration file'
    );
    return null;
  }
}
