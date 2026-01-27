import { HermitDatasource } from '../../datasource/hermit/index.ts';
import { id as versionId } from '../../versioning/hermit/index.ts';
import { defaultConfig as partialDefaultConfig } from './default-config.ts';
export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';
export { updateDependency } from './update.ts';

export const url = 'https://cashapp.github.io/hermit';

export const defaultConfig = {
  managerFilePatterns: partialDefaultConfig.managerFilePatterns,
  excludeCommitPaths: partialDefaultConfig.excludeCommitPaths,
  versioning: versionId,
};

export const supportedDatasources = [HermitDatasource.id];
