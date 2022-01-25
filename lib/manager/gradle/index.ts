import { ProgrammingLanguage } from '../../constants';
import * as datasourceMaven from '../../datasource/maven';
import * as gradleVersioning from '../../versioning/gradle';
import type {
  ExtractConfig,
  PackageFile,
  UpdateDependencyConfig,
} from '../types';
import * as deep from './deep';
import * as shallow from './shallow';
import type { GradleManagerData } from './types';

export function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  return config.deepExtract
    ? deep.extractAllPackageFiles(config, packageFiles)
    : shallow.extractAllPackageFiles(config, packageFiles);
}

export function updateDependency(
  params: UpdateDependencyConfig<GradleManagerData>
): string | null {
  return params.upgrade?.deepExtract
    ? deep.updateDependency(params)
    : shallow.updateDependency(params);
}

export const language = ProgrammingLanguage.Java;

export const defaultConfig = {
  fileMatch: [
    '\\.gradle(\\.kts)?$',
    '(^|\\/)gradle\\.properties$',
    '(^|\\/)gradle\\/.+\\.toml$',
    '\\.versions\\.toml$',
  ],
  timeout: 600,
  versioning: gradleVersioning.id,
};

export const supportedDatasources = [datasourceMaven.id];
