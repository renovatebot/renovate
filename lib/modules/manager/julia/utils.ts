import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import {
  getSiblingFileName,
  localPathExists,
  readLocalDirectory,
} from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import { api as juliaVersioning } from '../../versioning/julia/index.ts';
import { JuliaManifest } from './schema.ts';

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

/**
 * Returns the `julia_version` of the manifest, or `undefined` for a manifest
 * without one, which Julia 1.6 or older wrote.
 */
function getManifestJuliaVersion(manifestContent: string): string | undefined {
  return JuliaManifest.safeParse(manifestContent).data?.julia_version;
}

/**
 * Returns the minor version of the Julia that wrote the manifest, such as
 * `1.10`, and `1.6` for a manifest without `julia_version`.
 */
export function getJuliaMinor(manifestContent: string): string {
  const juliaVersion = getManifestJuliaVersion(manifestContent);
  if (!juliaVersion || !juliaVersioning.isVersion(juliaVersion)) {
    return '1.6';
  }
  const major = juliaVersioning.getMajor(juliaVersion);
  const minor = juliaVersioning.getMinor(juliaVersion);
  return `${major}.${minor}`;
}

/**
 * Returns the juliaup channel of the Julia that wrote the manifest: its
 * `julia_version`, or `1.6` for a manifest without one.
 */
export function getJuliaupChannel(manifestContent: string): string {
  return getManifestJuliaVersion(manifestContent) ?? '1.6';
}
