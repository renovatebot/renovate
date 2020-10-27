import { safeLoad } from 'js-yaml';

import { logger } from '../../logger';
import { PackageFile } from '../common';
import { getDep } from '../dockerfile/extract';

interface DockerComposeConfig {
  version?: string;
  services?: Record<string, DockerComposeService>;
}

interface DockerComposeService {
  image?: string;
  build?: {
    context?: string;
    dockerfile?: string;
  };
}

class LineMapper {
  private imageLines: { line: string; lineNumber: number; used: boolean }[];

  constructor(content: string, filter: RegExp) {
    this.imageLines = [...content.split('\n').entries()]
      .filter((entry) => filter.test(entry[1]))
      .map(([lineNumber, line]) => ({ lineNumber, line, used: false }));
  }

  pluckLineNumber(imageName: string): number {
    const lineMeta = this.imageLines.find(
      ({ line, used }) => !used && line.includes(imageName)
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
  fileName?: string
): PackageFile | null {
  logger.debug('docker-compose.extractPackageFile()');
  let config: DockerComposeConfig;
  try {
    // TODO: fix me
    config = safeLoad(content, { json: true }) as unknown;
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
    const lineMapper = new LineMapper(content, /^\s*image:/);

    const services =
      'version' in config
        ? config.services // docker-compose version 2+
        : config; // docker-compose version 1 (services at top level)

    // Image name/tags for services are only eligible for update if they don't
    // use variables and if the image is not built locally
    const deps = Object.values(services || {})
      .filter((service) => service?.image && !service?.build)
      .map((service) => {
        const dep = getDep(service.image);
        const lineNumber = lineMapper.pluckLineNumber(service.image);
        // istanbul ignore if
        if (!lineNumber) {
          return null;
        }
        return dep;
      })
      .filter(Boolean);

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
