import type { ProgrammingLanguage } from '../../../constants';
import { MavenDatasource } from '../../datasource/maven';
import * as gradleVersioning from '../../versioning/gradle';
import type {
  ExtractConfig,
  PackageFile,
  UpdateArtifact,
  UpdateArtifactsResult,
  UpdateDependencyConfig,
} from '../types';

export const language: ProgrammingLanguage = 'java';
export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: [
    '\\.gradle(\\.kts)?$',
    '(^|/)gradle\\.properties$',
    '(^|/)gradle/.+\\.toml$',
    '\\.versions\\.toml$',
    // The two below is for gradle-consistent-versions plugin
    `(^|/)versions.props$`,
    `(^|/)versions.lock$`,
  ],
  timeout: 600,
  versioning: gradleVersioning.id,
};

export const supportedDatasources = [MavenDatasource.id];

export function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  return import('./extract').then((m) =>
    m.extractAllPackageFiles(config, packageFiles)
  );
}

export function updateDependency(
  config: UpdateDependencyConfig
): Promise<string | null> {
  return import('./update').then((m) => m.updateDependency(config));
}

export function updateArtifacts(
  config: UpdateArtifact
): Promise<UpdateArtifactsResult[] | null> {
  return import('./artifacts').then((m) => m.updateArtifacts(config));
}
