import { HermitDatasource } from '../../datasource/hermit';
import { id as versionId } from '../../versioning/hermit';
import { updateArtifacts } from './artifacts';
import { defaultConfig as partialDefaultConfig } from './default-config';
import { extractPackageFile } from './extract';
import { updateDependency } from './update';

export { extractPackageFile, updateDependency, updateArtifacts };

export const defaultConfig = {
  ...partialDefaultConfig,
  versioning: versionId,
};

export const supportedDatasources = [HermitDatasource.id];
