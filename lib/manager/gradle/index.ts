import { LANGUAGE_JAVA } from '../../constants/languages';
import * as gradleVersioning from '../../versioning/gradle';
import { ExtractConfig, PackageFile, UpdateDependencyConfig } from '../types';
import * as deep from './deep';

export function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  return deep.extractAllPackageFiles(config, packageFiles);
}

export function updateDependency(params: UpdateDependencyConfig): string {
  return deep.updateDependency(params);
}

export const language = LANGUAGE_JAVA;

export const defaultConfig = {
  fileMatch: ['\\.gradle(\\.kts)?$', '(^|/)gradle.properties$'],
  timeout: 600,
  versioning: gradleVersioning.id,
};
