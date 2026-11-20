import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import {
  getSiblingFileName,
  isValidLocalPath,
  localPathExists,
  readLocalDirectory,
  readLocalFile,
} from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import { api as juliaVersioning } from '../../versioning/julia/index.ts';
import { JuliaProject } from './schema.ts';

const versionedManifestRegex = regEx(/^(?:Julia)?Manifest-v\d+\.\d+\.toml$/);

/**
 * Returns the workspace project whose manifest the project uses, as Julia's
 * `Base.base_project` finds it: the nearest project file in a parent
 * directory, within the repository, whose `[workspace]` lists the project's
 * directory in `projects`.
 * @param packageFile - the project file
 * @returns the workspace's project file and its `manifest` entry
 */
async function getWorkspaceProject(
  packageFile: string,
): Promise<{ projectFile: string; manifest?: string } | null> {
  const projectDir = upath.dirname(packageFile);
  let dir = projectDir;
  while (dir !== '.') {
    dir = upath.dirname(dir);
    // Julia takes the first of these that exists as the directory's project.
    for (const fileName of ['JuliaProject.toml', 'Project.toml']) {
      const projectFile = upath.join(dir, fileName);
      const content = await readLocalFile(projectFile, 'utf8');
      if (!content) {
        continue;
      }

      const parsed = JuliaProject.safeParse(content);
      const projects = parsed.success
        ? parsed.data.workspace?.projects
        : undefined;
      if (
        projects?.some((project) => upath.join(dir, project) === projectDir)
      ) {
        return { projectFile, manifest: parsed.data?.manifest };
      }
      break;
    }
  }
  return null;
}

/**
 * Returns the manifests that some Julia version uses with the project file,
 * as Pkg picks them: those of the workspace that lists the project, else the
 * file that the project's `manifest` entry names, else for Julia X.Y the first of
 * `JuliaManifest-vX.Y.toml`, `Manifest-vX.Y.toml`, `JuliaManifest.toml` and
 * `Manifest.toml` that exists.
 * @param packageFile - the project file
 * @param manifest - the project's `manifest` entry, relative to its directory
 */
export async function getManifestFileNames(
  packageFile: string,
  manifest: string | undefined,
): Promise<string[]> {
  const workspace = await getWorkspaceProject(packageFile);
  if (workspace) {
    return getManifestFileNames(workspace.projectFile, workspace.manifest);
  }

  // Pkg reads and writes the named manifest even before it exists, while Base
  // falls back to the default names when it does not exist.
  if (manifest) {
    const manifestFile = getSiblingFileName(packageFile, manifest);
    if (!isValidLocalPath(manifestFile)) {
      logger.debug(
        { packageFile, manifestFile },
        'Julia manifest is outside the repository',
      );
      return [];
    }
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
