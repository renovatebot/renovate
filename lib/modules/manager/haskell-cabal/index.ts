import type { ReleaseType } from 'semver';
import type { Category } from '../../../constants';
import { HackageDatasource } from '../../datasource/hackage';
import * as semverVersioning from '../../versioning/semver';
import type { BumpPackageVersionResult } from '../types';
import { logger } from '../../../logger';
import type { RangeStrategy } from '../../../types';
import type { RangeConfig } from '../types';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['\\.cabal$'],
  pinDigests: false,
  versioning: semverVersioning.id,
};

export const categories: Category[] = ['haskell'];

export const supportedDatasources = [HackageDatasource.id];

export function bumpPackageVersion(
  content: string,
  currentValue: string,
  bumpVersion: ReleaseType,
): BumpPackageVersionResult {
  logger.debug({content, currentValue, bumpVersion}, 'bumpPackageVersion');
  let bumpedContent = content;
  return {bumpedContent};
}

export function getRangeStrategy({currentValue, rangeStrategy}: RangeConfig): RangeStrategy {
  if (rangeStrategy !== 'auto') {
    return rangeStrategy;
  }
  return 'widen';
}
