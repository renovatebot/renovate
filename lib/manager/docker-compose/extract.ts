import { safeLoad } from 'js-yaml';

import { logger } from '../../logger';
import { getDep } from '../dockerfile/extract';
import { PackageFile } from '../common';

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
      .filter(entry => filter.test(entry[1]))
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
    config = safeLoad(content, { json: true });
    // istanbul ignore if
    if (!config) {
      logger.debug(
        { fileName },
        'Null config when parsing Docker Compose content'
      );
      return null;
    }
  } catch (err) {
    logger.debug({ err }, 'err');
    logger.info({ fileName }, 'Parsing Docker Compose config YAML');
    return null;
  }
  try {
    const lineMapper = new LineMapper(content, /^\s*image:/);

    // Image name/tags for services are only eligible for update if they don't
    // use variables and if the image is not built locally
    const deps = Object.values(config.services || {})
      .filter(service => service && service.image && !service.build)
      .map(service => {
        const dep = getDep(service.image);
        const lineNumber = lineMapper.pluckLineNumber(service.image);
        // istanbul ignore if
        if (!lineNumber) {
          return null;
        }
        dep.managerData = { lineNumber };
        return dep;
      })
      .filter(Boolean);

    logger.trace({ deps }, 'Docker Compose image');
    if (!deps.length) {
      return null;
    }
    return { deps };
  } catch (err) /* istanbul ignore next */ {
    logger.warn(
      { fileName, content, err },
      'Error extracting Docker Compose file'
    );
    return null;
  }
}
