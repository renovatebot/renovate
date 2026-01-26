import { logger } from '../../../logger';
import { PuppetForgeDatasource } from '../../datasource/puppet-forge';
import type {
  PackageDependency,
  PackageFileContent,
  UpdateDependencyConfig,
} from '../types';

interface PuppetModuleDependencyEntry {
  name?: string;
  version_requirement?: string; // official dependency constraint field
}

interface PuppetMetadataJson {
  dependencies?: PuppetModuleDependencyEntry[];
}

// Accept either `author/module` or `author-module` form.
// We normalize to slash form for depName/packageName while keeping original in file.
const DEP_REGEX = /^[a-zA-Z0-9_]+[/-][a-zA-Z0-9_-]+$/;

function normalizeName(raw: string): string {
  return raw.includes('/') ? raw : raw.replace('-', '/');
}

export function extractPackageFile(content: string): PackageFileContent | null {
  logger.trace('puppet-module.extractPackageFile()');
  let json: PuppetMetadataJson;
  try {
    json = JSON.parse(content);
  } catch (err) {
    logger.debug({ err }, 'puppet-module: invalid JSON');
    return null;
  }

  const deps: PackageDependency[] = [];
  for (const dep of json.dependencies ?? []) {
    if (!dep?.name) {
      continue;
    }
    if (!DEP_REGEX.test(dep.name)) {
      deps.push({
        depName: dep.name,
        skipReason: 'invalid-name',
      });
      continue;
    }

    const normalized = normalizeName(dep.name);
    // version requirement may be in version_requirement or version field
    const currentValue = dep.version_requirement;
    if (!currentValue) {
      // treat as unconstrained => skip? Pattern in Renovate often sets skipReason
      deps.push({
        depName: normalized,
        datasource: PuppetForgeDatasource.id,
        packageName: normalized,
        skipReason: 'unspecified-version',
      });
      continue;
    }

    deps.push({
      depName: normalized,
      packageName: normalized,
      currentValue,
      datasource: PuppetForgeDatasource.id,
    });
  }

  return deps.length ? { deps } : null;
}

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  logger.trace('puppet-module.updateDependency()');
  let json: PuppetMetadataJson;
  try {
    json = JSON.parse(fileContent);
  } catch (err) {
    logger.debug({ err }, 'puppet-module: invalid JSON on update');
    return null;
  }
  if (!json.dependencies?.length) {
    return null;
  }
  const depName = upgrade.depName ?? upgrade.packageName;
  if (!depName) {
    return null;
  }
  const newValue = upgrade.newValue ?? upgrade.newVersion;
  if (!newValue) {
    return null; // nothing to set
  }
  let changed = false;
  for (const dep of json.dependencies) {
    if (normalizeName(dep.name ?? '') === depName) {
      if (dep.version_requirement !== newValue) {
        dep.version_requirement = newValue;
        changed = true;
      }
      break;
    }
  }
  if (!changed) {
    return null;
  }
  // Preserve formatting minimally: output pretty-compact similar to other json managers? Use 2-space indent.
  try {
    return JSON.stringify(json, null, 2) + '\n';
  } catch (err) {
    logger.debug({ err }, 'puppet-module: failed to stringify updated JSON');
    return null;
  }
}
