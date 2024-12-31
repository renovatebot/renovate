import { z } from 'zod';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { parseSingleYaml } from '../../../util/yaml';

import {
  extractDependency,
  parseDepName,
} from '../npm/extract/common/dependency';
import { setNodeCommitTopic } from '../npm/extract/common/node';
import type { NpmPackageDependency } from '../npm/extract/types';
import type { NpmManagerData } from '../npm/types';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types';

function matchesFileName(fileNameWithPath: string, fileName: string): boolean {
  return (
    fileNameWithPath === fileName || fileNameWithPath.endsWith(`/${fileName}`)
  );
}

// TODO(fpapado): consider writing extractPackageFile first, then looping (with
// post- hooks) in extractAllPackageFiles

export async function extractAllPackageFiles(
  config: ExtractConfig,
  matchedFiles: string[],
): Promise<PackageFile[]> {
  const packageFiles: PackageFile<NpmManagerData>[] = [];
  for (const matchedFile of matchedFiles) {
    if (!matchesFileName(matchedFile, 'pnpm-workspace.yaml')) {
      logger.warn({ matchedFile }, 'Invalid pnpm-workspace.yaml match');
      continue;
    }
    // TODO: Consider what to do about workspace: specifiers
    let pnpmCatalogs: PnpmCatalogs;
    try {
      const content = (await readLocalFile(matchedFile, 'utf8'))!;
      pnpmCatalogs = parsePnpmCatalogs(content);
    } catch (err) {
      logger.debug({ err, matchedFile }, 'Error parsing pnpm-workspace.yaml');
      continue;
    }

    const packageFile = matchedFile;
    const extracted = extractPnpmCatalogDeps(pnpmCatalogs);

    if (!extracted) {
      logger.debug({ packageFile }, 'No dependencies found');
      continue;
    }

    const res: PackageFile = {
      ...extracted,
      packageFile,
      lockFiles: [matchedFile],
    };

    packageFiles.push(res);
  }

  return packageFiles;
}

/**
 * A pnpm catalog is either the default catalog (catalog:, catlog:default), or a
 * named one (under catalogs:)
 */
type CatalogType =
  | { type: 'default'; name: 'default' }
  | { type: 'named'; name: string };

type PnpmCatalogs = Array<CatalogType & { dependencies: NpmPackageDependency }>;

const CATALOG_DEPENDENCY = 'catalogDependency';

export interface PnpmCatalogManagerData extends Record<string, any> {
  // TODO(fpapado): thread the pnpm-lock.yaml location; we will likely need it
  // for updating
  pnpmShrinkwrap?: string;
  // TODO(fpapado): we likely want other fields from the npm manager data here,
  // such as `skipInstalls`
}

function extractPnpmCatalogDeps(
  catalogs: PnpmCatalogs,
): PackageFileContent<NpmManagerData> | null {
  const deps: PackageDependency[] = [];

  for (const catalog of catalogs) {
    for (const [key, val] of Object.entries(catalog.dependencies)) {
      const depName = parseDepName('catalog', key);
      let dep: PackageDependency = {
        depType: CATALOG_DEPENDENCY,
        depName,
        managerData: {
          // we assign the name of the catalog, in order to know what fields to
          // update later on
          catalogType: catalog.type,
          catalogName: catalog.name,
        },
      };
      if (depName !== key) {
        dep.managerData!.key = key;
      }

      // TODO: fix type #22198
      // FIXME(fpapado): small crime with `val!`
      dep = { ...dep, ...extractDependency(CATALOG_DEPENDENCY, depName, val!) };
      // TODO(fpapado): verify whether we need this
      setNodeCommitTopic(dep);
      dep.prettyDepType = CATALOG_DEPENDENCY;
      deps.push(dep);
    }
  }

  logger.info(deps);

  return {
    deps,
  };
}

const pnpmCatalogsSchema = z.object({
  catalog: z.optional(z.record(z.string())),
  catalogs: z.optional(z.record(z.record(z.string()))),
});

function parsePnpmCatalogs(content: string): PnpmCatalogs {
  const { catalog: defaultCatalogDeps, catalogs: namedCatalogs } =
    parseSingleYaml(content, { customSchema: pnpmCatalogsSchema });

  return [
    {
      type: 'default',
      name: 'default',
      dependencies: defaultCatalogDeps ?? {},
    },
    ...Object.entries(namedCatalogs ?? {}).map(
      ([name, dependencies]) =>
        ({
          type: 'named',
          name,
          dependencies,
        }) as const,
    ),
  ];
}
