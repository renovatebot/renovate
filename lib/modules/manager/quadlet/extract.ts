import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { QuadletFile } from './schema';

function startsWithAny(image: string, prefixes: string[]): boolean {
  return !!prefixes.find((prefix) => image.startsWith(prefix));
}

function endsWithAny(image: string, suffixes: string[]): boolean {
  return !!suffixes.find((suffix) => image.endsWith(suffix));
}

function getQuadletImage(
  image: string | null | undefined,
  ignoredSuffixes: string[],
  deps: PackageDependency[],
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
    const cleanedImage = image
      .replace(regEx(/^docker:\/\//), '')
      .replace(regEx(/^docker-daemon:/), '');
    const dep = getDep(cleanedImage, false, config.registryAliases);
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
  const deps: PackageDependency[] = [];

  const res = QuadletFile.safeParse(content);
  if (!res.success) {
    logger.debug(
      { err: res.error, packageFile },
      'Error parsing Quadlet file.',
    );
    return null;
  }

  const quadletFile: QuadletFile = res.data;

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
