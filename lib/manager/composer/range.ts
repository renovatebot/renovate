import { logger } from '../../logger';
import { RangeConfig } from '../common';
import { RangeStrategy } from '../../versioning';

export function getRangeStrategy(config: RangeConfig): RangeStrategy {
  const {
    managerData = {},
    depType,
    depName,
    currentValue,
    rangeStrategy,
  } = config;
  const { composerJsonType } = managerData;
  const isComplexRange = currentValue && currentValue.includes(' || ');
  if (rangeStrategy === 'bump' && isComplexRange) {
    logger.info(
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
    !['library', 'metapackage', 'composer-plugin'].includes(composerJsonType);
  if (isApp && depType === 'require') {
    // Pin dependencies if it's an app/project
    logger.trace({ dependency: depName }, 'Pinning app require');
    return 'pin';
  }
  if (isComplexRange) {
    return 'widen';
  }
  return 'replace';
}
