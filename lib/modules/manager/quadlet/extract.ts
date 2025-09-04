import { logger } from '../../../logger';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { QuadletFile, Ini } from './schema';

function startsWithAny(image: string, prefixes: string[]): boolean {
  return !!prefixes.find((prefix) => image.startsWith(prefix));
}

function endsWithAny(image: string, suffixes: string[]): boolean {
  return !!suffixes.find((suffix) => image.endsWith(suffix));
}

function getQuadletImage(
  image: string | null | undefined,
  ignoredSuffixes: string[],
  deps: PackageDependency<Record<string, any>>[],
  config: ExtractConfig,
): void {
  if (
    image &&
    // Ignore transports that do not resolve to a registry
    // https://github.com/containers/image/blob/main/docs/containers-transports.5.md
    !startsWithAny(image, [
      'dir:',
      'docker-archive:',
      'oci-archive:',
      'oci:',
      'containers-storage:',
      'sif:',
    ]) &&
    !endsWithAny(image, ignoredSuffixes)
  ) {
    // Remove the docker:// or docker-daemon: transport prefix, if present
    image = image.replace(/^docker:\/\//, '').replace(/^docker-daemon:/, '');
    const dep = getDep(image, false, config.registryAliases);
    if (dep) {
      dep.depType = 'image';

      deps.push(dep);
    }
  }
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  let quadletFile: QuadletFile;
  try {
    quadletFile = Ini.pipe(QuadletFile).parse(content);
  } catch (err) {
    logger.debug(
      { err, packageFile },
      'Failed to parse quadlet container file',
    );
    return null;
  }
  const deps: PackageDependency<Record<string, any>>[] = [];

  getQuadletImage(
    quadletFile?.Container?.Image,
    ['.image', '.build'],
    deps,
    config,
  );
  getQuadletImage(quadletFile?.Image?.Image, [], deps, config);
  getQuadletImage(quadletFile?.Volume?.Image, ['.image'], deps, config);

  if (deps.length) {
    return { deps };
  }
  return null;
}
