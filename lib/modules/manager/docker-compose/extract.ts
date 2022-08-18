import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import { getDep } from '../dockerfile/extract';
import type { ExtractConfig, PackageFile } from '../types';
import type { DockerComposeConfig } from './types';

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
  logger.debug('docker-compose.extractPackageFile()');
  let config: DockerComposeConfig;
  try {
    // TODO: fix me (#9610)
    config = load(content, { json: true }) as DockerComposeConfig;
    if (!config) {
      logger.debug(
        { fileName },
        'Null config when parsing Docker Compose content'
      );
      return null;
    }
    if (typeof config !== 'object') {
      logger.debug(
        { fileName, type: typeof config },
        'Unexpected type for Docker Compose content'
      );
      return null;
    }
  } catch (err) {
    logger.debug({ err }, 'err');
    logger.debug({ fileName }, 'Parsing Docker Compose config YAML');
    return null;
  }
  try {
    const lineMapper = new LineMapper(content, regEx(/^\s*image:/));

    // docker-compose v1 places the services at the top level,
    // docker-compose v2+ places the services within a 'services' key
    // since docker-compose spec version 1.27, the 'version' key has
    // become optional and can no longer be used to differentiate
    // between v1 and v2.
    const services = config.services ?? config;

    // Image name/tags for services are only eligible for update if they don't
    // use variables and if the image is not built locally
    const deps = Object.values(services || {})
      .filter((service) => is.string(service?.image) && !service?.build)
      .map((service) => {
        const dep = getDep(service.image, true, extractConfig.registryAliases);
        const lineNumber = lineMapper.pluckLineNumber(service.image);
        // istanbul ignore if
        if (!lineNumber) {
          return null;
        }
        return dep;
      })
      .filter(is.truthy);

    logger.trace({ deps }, 'Docker Compose image');
    return { deps };
  } catch (err) /* istanbul ignore next */ {
    logger.warn(
      { fileName, content, err },
      'Error extracting Docker Compose file'
    );
    return null;
  }
}
