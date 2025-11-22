import { logger } from '../../../logger';
import { getSiblingFileName, readLocalFile } from '../../../util/fs';
import { parseSingleYaml } from '../../../util/yaml';
import { ApkDatasource } from '../../datasource/apk';
import { id as apkVersioning } from '../../versioning/apk';
import type { PackageDependency, PackageFileContent } from '../types';

// Simple schema for apko configuration
interface ApkoConfig {
  contents?: {
    repositories?: string[];
    packages?: string[];
  };
  environment?: Record<string, string>;
  cmd?: string;
  archs?: string[];
}

// Schema for apko lock file
interface ApkoLockFile {
  version: string;
  config: {
    name: string;
    checksum: string;
  };
  contents: {
    keyring: string[];
    build_repositories: string[];
    runtime_repositories: string[];
    repositories: {
      name: string;
      url: string;
      architecture: string;
    }[];
    packages: {
      name: string;
      url: string;
      version: string;
      architecture: string;
      checksum: string;
    }[];
  };
}

// apko allows arch alias, see https://github.com/chainguard-dev/apko/blob/5244a17ae460bb053b7d13302d48fd0046aeb387/pkg/apk/apk/arch.go
function translateArch(arch: string): string {
  switch (arch) {
    case 'i386':
    case '386':
      return 'x86';
    case 'amd64':
      return 'x86_64';
    case 'arm64':
      return 'aarch64';
    case 'arm/v6':
      return 'armhf';
    case 'arm/v7':
      return 'armv7';
    default:
      return arch;
  }
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  logger.trace('apko.extractPackageFile()');

  try {
    const parsed = parseSingleYaml<ApkoConfig>(content);
    const deps: PackageDependency[] = [];

    // Check if archs is specified
    if (!parsed.archs) {
      throw new Error('archs must be specified');
    }

    // Extract packages from the contents.packages array
    if (parsed.contents?.packages) {
      // determine the registry URLs based on the archs
      const registryUrls = parsed.archs.map((arch) => {
        const translatedArch = translateArch(arch);
        return `${parsed.contents?.repositories?.[0]}/${translatedArch}`;
      });

      for (const pkg of parsed.contents.packages) {
        // Try to extract version from package.
        // format is name{@tag}{[<>~=]version} - from https://wiki.alpinelinux.org/wiki/Alpine_Package_Keeper#World
        const versionMatch = /^(.+?)([=><~][=]?.+)$/.exec(pkg);

        if (versionMatch) {
          const [, depName, fullConstraint] = versionMatch;

          // We are only concerned with packages with = version constraint
          // Range constraints (>, ~, <) are not supported

          if (/^[><~]/.test(fullConstraint)) {
            logger.debug(
              { depName, constraint: fullConstraint },
              'Skipping dependency with range constraint - not supported in apko.yaml',
            );
            deps.push({
              datasource: ApkDatasource.id,
              depName,
              skipReason: 'unsupported-version',
              registryUrls,
            });
            continue;
          }

          // Only process exact versions (=version)
          // Strip the = operator for cleaner display in PRs
          const cleanVersion = fullConstraint.replace(/^=/, '');
          const hasRevision = /-r\d+$/.test(cleanVersion);

          const dep: any = {
            datasource: ApkDatasource.id,
            depName,
            currentValue: cleanVersion, // Store without = operator (clean for PR display)
            versioning: apkVersioning,
            registryUrls,
            managerData: {
              hasRevision, // Track if current version has revision
            },
          };
          deps.push(dep);
        } else {
          // Package without version - add as unversioned
          deps.push({
            datasource: ApkDatasource.id,
            depName: pkg,
            skipReason: 'not-a-version',
            registryUrls,
          });
        }
      }
    }

    if (!deps.length) {
      return null;
    }

    // Derive lockfile name from package file name
    // If package file is 'image.yaml', lockfile should be 'image.lock.json'
    const packageFileName =
      packageFile.split('/').pop() ?? 'apko.yaml'; /* v8 ignore next */
    const baseName = packageFileName.replace(/\.ya?ml$/, '');
    const lockFileName = getSiblingFileName(
      packageFile,
      `${baseName}.lock.json`,
    );
    const lockFileContent = await readLocalFile(lockFileName, 'utf8');

    let lockFiles: string[] | undefined;

    if (lockFileContent) {
      try {
        const lockFile = parseSingleYaml<ApkoLockFile>(lockFileContent);

        // Create a mapping of package names to locked versions
        const lockedVersions = new Map<string, string>();
        const lockedPackages = new Set<string>();

        // Process all packages from the lock file
        for (const pkg of lockFile.contents?.packages || []) {
          lockedVersions.set(pkg.name, pkg.version);
          lockedPackages.add(pkg.name);
        }

        // Add locked versions to dependencies that are in both files
        for (const dep of deps) {
          if (dep.depName && lockedVersions.has(dep.depName)) {
            dep.lockedVersion = lockedVersions.get(dep.depName);
            // Keep architecture-specific URLs for locked packages
          }
        }

        logger.debug(
          { packageFile, lockFileName, packageCount: deps.length },
          'Found apko.lock.json with locked versions',
        );
        lockFiles = [lockFileName];
      } catch (err) {
        logger.debug({ err, lockFileName }, 'Error parsing apko.lock.json');
        // Use architecture-specific repository URLs when lock file parsing fails
        const registryUrls =
          parsed.archs?.map((arch) => {
            const translatedArch = translateArch(arch);
            return `${parsed.contents?.repositories?.[0]}/${translatedArch}`;
          }) || parsed.contents?.repositories; /* v8 ignore next */

        for (const dep of deps) {
          dep.registryUrls = registryUrls;
        }
        lockFiles = ['not here'];
      }
    }

    return {
      deps,
      lockFiles,
    };
  } catch (err) {
    logger.debug({ err, packageFile }, 'Error parsing apko YAML configuration');
    return null;
  }
}
