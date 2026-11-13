import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import {
  getSiblingFileName,
  localPathExists,
  readLocalDirectory,
} from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import { api as juliaVersioning } from '../../versioning/julia/index.ts';

const versionedManifestRegex = regEx(/^(?:Julia)?Manifest-v\d+\.\d+\.toml$/);

/**
 * Returns the manifests that some Julia version uses with the project file,
 * as Julia's `Base.project_file_manifest_path` picks them: the file that the
 * project's `manifest` entry names, or else for Julia X.Y the first of
 * `JuliaManifest-vX.Y.toml`, `Manifest-vX.Y.toml`, `JuliaManifest.toml` and
 * `Manifest.toml` that exists.
 * @param packageFile - the project file
 * @param manifest - the project's `manifest` entry, relative to its directory
 */
export async function getManifestFileNames(
  packageFile: string,
  manifest: string | undefined,
): Promise<string[]> {
  if (manifest) {
    const manifestFile = getSiblingFileName(packageFile, manifest);
    return (await localPathExists(manifestFile)) ? [manifestFile] : [];
  }

  let fileNames: string[];
  try {
    fileNames = await readLocalDirectory(upath.dirname(packageFile));
  } catch (err) {
    logger.debug({ packageFile, err }, 'Failed to list the project directory');
    return [];
  }

  // `JuliaManifest-vX.Y.toml` takes precedence over `Manifest-vX.Y.toml`.
  const versioned = new Map<string, string>();
  for (const fileName of fileNames.filter((name) =>
    versionedManifestRegex.test(name),
  )) {
    const key = fileName.replace(regEx(/^Julia/), '');
    if (!versioned.has(key) || fileName.startsWith('Julia')) {
      versioned.set(key, fileName);
    }
  }
  const plain = ['JuliaManifest.toml', 'Manifest.toml'].find((name) =>
    fileNames.includes(name),
  );
  return [...versioned.values(), ...(plain ? [plain] : [])]
    .sort()
    .map((fileName) => getSiblingFileName(packageFile, fileName));
}

const manifestJuliaVersionRegex = regEx(/-v(?<julia>\d+\.\d+)\.toml$/);

/**
 * Returns the manifest whose versions count as the locked versions: the
 * unversioned manifest if there is one, else the versioned manifest of the
 * newest Julia.
 * @param manifestFiles - the manifests from `getManifestFileNames`
 */
export function getLockedVersionsManifest(
  manifestFiles: string[],
): string | undefined {
  let newestFile: string | undefined;
  let newestJulia = '';
  for (const file of manifestFiles) {
    const julia = manifestJuliaVersionRegex.exec(file)?.groups?.julia;
    if (!julia) {
      return file;
    }
    const juliaVersion = `${julia}.0`;
    if (
      !newestFile ||
      juliaVersioning.isGreaterThan(juliaVersion, newestJulia)
    ) {
      newestFile = file;
      newestJulia = juliaVersion;
    }
  }
  return newestFile;
}
