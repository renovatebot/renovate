import { HermitDatasource } from '../../datasource/hermit';
import { id as versionId } from '../../versioning/hermit';
import { defaultConfig as partialDefaultConfig } from './default-config';
export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const defaultConfig = {
  fileMatch: partialDefaultConfig.fileMatch,
  excludeCommitPaths: partialDefaultConfig.excludeCommitPaths,
  versioning: versionId,
};

export const supportedDatasources = [HermitDatasource.id];
