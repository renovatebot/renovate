import { ReleaseType, inc } from 'semver';
import { logger } from '../../logger';

export function bumpPackageVersion(
  content: string,
  currentValue: string,
  bumpVersion: ReleaseType | string
): string {
  logger.debug(
    {
      bumpVersion,
      currentValue,
    },
    'Checking if we should bump build.sbt version'
  );
  let newVersion: string;
  try {
    logger.info({
      content,
      currentValue,
      bumpVersion,
    });

    newVersion = inc(currentValue, bumpVersion as ReleaseType);

    if (!newVersion) {
      throw new Error('Version incremental failed');
    }

    logger.info({ newVersion });

    const bumpedContent = content.replace(
      /^(version\s*:=\s*).*$/m,
      `$1"${newVersion}"`
    );

    if (bumpedContent === content) {
      logger.info('Version was already bumped');
    } else {
      logger.info('Bumped build.sbt version');
    }

    return bumpedContent;
  } catch (err) {
    logger.warn(
      {
        content,
        currentValue,
        bumpVersion,
      },
      'Failed to bumpVersion'
    );

    return content;
  }
}
