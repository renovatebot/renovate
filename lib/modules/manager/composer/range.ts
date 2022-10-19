import { logger } from '../../../logger';
import type { RangeStrategy } from '../../../types';
import type { RangeConfig } from '../types';
import type { ComposerManagerData } from './types';

export function getRangeStrategy(config: RangeConfig): RangeStrategy {
  const {
    managerData = {},
    depType,
    depName,
    currentValue,
    rangeStrategy,
  } = config;
  const { composerJsonType } = managerData as ComposerManagerData;
  const isComplexRange = currentValue?.includes(' || ');
  if (rangeStrategy === 'bump' && isComplexRange) {
    logger.debug(
      { currentValue },
      'Replacing bump strategy for complex range with widen'
    );
    return 'widen';
  }
  if (rangeStrategy !== 'auto') {
    return rangeStrategy;
  }
  if (depType === 'require-dev') {
    // Always pin dev dependencies
    logger.trace({ dependency: depName }, 'Pinning require-dev');
    return 'pin';
  }
  const isApp =
    composerJsonType &&
    ![
      'library',
      'metapackage',
      'composer-plugin',
      'symfony-bundle',
      'typo3-cms-extension',
    ].includes(composerJsonType);
  if (isApp && depType === 'require') {
    // Pin dependencies if it's an app/project
    logger.trace({ dependency: depName }, 'Pinning app require');
    return 'pin';
  }
  if (
    isComplexRange ||
    (composerJsonType && ['typo3-cms-extension'].includes(composerJsonType))
  ) {
    return 'widen';
  }
  return 'replace';
}
