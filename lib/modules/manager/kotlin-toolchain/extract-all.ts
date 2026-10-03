import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import type { ExtractConfig, PackageFile } from '../types.ts';
import { normalizeCatalogAlias } from './catalog.ts';
import { extractPackageFile, extractRegistryUrls } from './extract.ts';
import { KotlinToolchainFile } from './schema.ts';
import type { KotlinToolchainManagerData } from './types.ts';

interface YamlFile {
  result: PackageFile<KotlinToolchainManagerData>;
  registryUrls: string[];
}

function closestRoot(file: string, roots: Set<string>): string | null {
  let directory = upath.dirname(file);
  while (true) {
    if (roots.has(directory)) {
      return directory;
    }
    if (directory === '.') {
      return null;
    }
    directory = upath.dirname(directory);
  }
}

async function usesGradle(root: string): Promise<boolean> {
  for (const name of [
    'settings.gradle',
    'settings.gradle.kts',
    'build.gradle',
    'build.gradle.kts',
  ]) {
    if ((await readLocalFile(upath.join(root, name), 'utf8')) !== null) {
      return true;
    }
  }
  return false;
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[] | null> {
  const yamlFiles: YamlFile[] = [];
  const projectRoots = new Set<string>();
  const moduleRoots = new Set<string>();
  const catalogFiles = new Set<string>();

  for (const packageFile of packageFiles) {
    if (upath.basename(packageFile) === 'libs.versions.toml') {
      catalogFiles.add(packageFile);
      continue;
    }
    const content = await readLocalFile(packageFile, 'utf8');
    if (!content) {
      continue;
    }
    const file = KotlinToolchainFile.safeParse(content);
    if (!file.success) {
      continue;
    }
    const result = extractPackageFile(content, packageFile);
    if (!result) {
      continue;
    }
    yamlFiles.push({
      result: { ...result, packageFile },
      registryUrls: extractRegistryUrls(file.data),
    });
    const name = upath.basename(packageFile);
    if (name === 'project.yaml') {
      projectRoots.add(upath.dirname(packageFile));
    } else if (name === 'module.yaml') {
      moduleRoots.add(upath.dirname(packageFile));
    }
  }

  const roots = new Set(projectRoots);
  for (const root of moduleRoots) {
    if (closestRoot(upath.join(root, 'module.yaml'), projectRoots) === null) {
      roots.add(root);
    }
  }

  const results = yamlFiles.map(({ result }) => result);
  for (const root of roots) {
    const candidates = [
      upath.join(root, 'libs.versions.toml'),
      upath.join(root, 'gradle/libs.versions.toml'),
    ].filter((file) => catalogFiles.has(file));
    if (!candidates.length || (await usesGradle(root))) {
      continue;
    }
    if (candidates.length > 1) {
      logger.info(
        `Skipping Kotlin Toolchain catalogs in ${root}: both catalog locations are present`,
      );
      continue;
    }

    const packageFile = candidates[0];
    const content = await readLocalFile(packageFile, 'utf8');
    if (content === null) {
      continue;
    }
    const catalog = extractPackageFile(content, packageFile);
    if (!catalog) {
      continue;
    }

    const projectFiles = yamlFiles.filter(
      ({ result }) => closestRoot(result.packageFile, roots) === root,
    );
    const repositoriesByAlias = new Map<string, string[]>();
    for (const file of projectFiles) {
      for (const { depName } of file.result.deps) {
        if (!depName!.startsWith('$libs.')) {
          continue;
        }
        const urls = coerceArray(repositoriesByAlias.get(depName!));
        urls.push(...file.registryUrls);
        repositoriesByAlias.set(depName!, urls);
      }
    }
    for (const dep of catalog.deps) {
      const alias = dep.managerData!.libraryAlias!;
      const reference = `$libs.${normalizeCatalogAlias(alias)}`;
      dep.registryUrls = [
        ...new Set([
          ...coerceArray(dep.registryUrls),
          ...coerceArray(repositoriesByAlias.get(reference)),
        ]),
      ];
    }
    results.push({ ...catalog, packageFile });
  }

  return results.length ? results : null;
}
