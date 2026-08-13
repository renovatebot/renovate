import type { Category } from '../../../constants/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';

export const categories: Category[] = ['python'];

import * as pep440 from '../../versioning/pep440/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';
export { updateDependency } from './update.ts';

export const url = 'https://copier.readthedocs.io';

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.copier-answers(\\..+)?\\.ya?ml/'],
  versioning: pep440.id,
};

export const supportedDatasources = [GitTagsDatasource.id];

export { knownDepTypes } from './dep-types.ts';
