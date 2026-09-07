import fs from 'fs-extra';
import { glob } from 'glob';
import upath from 'upath';
import type { DatasourceName } from '../../lib/datasource-list.generated.ts';
import { getDatasources } from '../../lib/modules/datasource/index.ts';
import { get, getManagerList } from '../../lib/modules/manager/index.ts';
import { regEx } from '../../lib/util/regex.ts';

const managerRoot = 'lib/modules/manager';

/**
 * Symbols that managers import from another manager's files (or from the
 * shared `manager/util.ts`) and which set `dep.datasource` on behalf of the
 * caller. The value lists the datasources the caller can emit through that
 * symbol; `'*'` means every datasource referenced in the helper file.
 *
 * Any import of a symbol from a cross-manager file that references datasource
 * ids must be listed here, so that a new shared helper is reviewed rather than
 * silently hiding drift.
 */
const helperDatasources: Record<string, DatasourceName[] | '*'> = {
  'lib/modules/manager/asdf/index.ts#supportedDatasources': '*',
  'lib/modules/manager/asdf/upgradeable-tooling.ts#upgradeableTooling': '*',
  'lib/modules/manager/buildpacks/extract.ts#BUILDPACK_REGISTRY_PREFIX': [],
  'lib/modules/manager/buildpacks/extract.ts#DOCKER_PREFIX': [],
  'lib/modules/manager/buildpacks/extract.ts#getDep': [
    'buildpacks-registry',
    'docker',
  ],
  'lib/modules/manager/buildpacks/extract.ts#isBuildpackRegistryRef': [],
  'lib/modules/manager/buildpacks/extract.ts#isDockerRef': [],
  'lib/modules/manager/cdnurl/extract.ts#cloudflareUrlRegex': [],
  'lib/modules/manager/dockerfile/extract.ts#getDep': ['docker'],
  // pre-commit only feeds `require` lines, never `go`/`toolchain` directives
  'lib/modules/manager/gomod/line-parser.ts#parseLine': ['go'],
  'lib/modules/manager/gradle/index.ts#updateArtifacts': [],
  'lib/modules/manager/kustomize/extract.ts#extractImage': ['docker'],
  'lib/modules/manager/maven/extract.ts#extractRegistries': [],
  // `node-version` is only emitted for the `engines`/`packageManager`/`volta`
  // depTypes, which no other manager passes
  'lib/modules/manager/npm/extract/common/dependency.ts#extractDependency': [
    'npm',
    'github-tags',
  ],
  'lib/modules/manager/npm/index.ts#getRangeStrategy': [],
  'lib/modules/manager/npm/index.ts#updateDependency': [],
  'lib/modules/manager/pep621/extract.ts#extractPackageFile': '*',
  'lib/modules/manager/pep621/utils.ts#depTypes': [],
  'lib/modules/manager/pep621/utils.ts#pep508ToPackageDependency': ['pypi'],
  'lib/modules/manager/pip_requirements/extract.ts#extractPackageFile': '*',
  'lib/modules/manager/pip_setup/index.ts#extractPackageFile': '*',
  // lock file lookups during artifact updates are not extraction
  'lib/modules/manager/terraform/lockfile/index.ts#updateArtifacts': [],
  'lib/modules/manager/util.ts#applyGitSource': '*',
  'lib/modules/manager/util.ts#artifactErrorMessageFromExecError': [],
};

/**
 * Maps a datasource class name (e.g. `GithubTagsDatasource`) to its id
 * (e.g. `github-tags`) using the registered instances, so that `Foo.id`
 * references in manager sources can be resolved without importing them.
 */
function getDatasourceClassIds(): Map<string, string> {
  const result = new Map<string, string>();
  for (const [id, datasource] of getDatasources()) {
    result.set(datasource.constructor.name, id);
  }
  return result;
}

async function listSourceFiles(dir: string): Promise<string[]> {
  const files = await glob('**/*.ts', {
    cwd: dir,
    ignore: ['**/*.spec.ts', '**/__fixtures__/**', '**/__snapshots__/**'],
    posix: true,
  });
  return files.sort().map((file) => upath.join(dir, file));
}

/**
 * Datasource ids a source file references: `SomeDatasource.id` member
 * accesses and `datasource: 'some-id'` / `datasource = 'some-id'` literals.
 */
function extractDatasourceIds(
  content: string,
  classIds: Map<string, string>,
): Set<string> {
  const ids = new Set<string>();
  for (const match of content.matchAll(
    regEx(/\b(?<className>[A-Z]\w+)\.id\b/g),
  )) {
    const id = classIds.get(match.groups!.className);
    if (id) {
      ids.add(id);
    }
  }
  for (const match of content.matchAll(
    regEx(/\bdatasource\s*[:=]\s*'(?<id>[a-z0-9-]+)'/g),
  )) {
    ids.add(match.groups!.id);
  }
  return ids;
}

interface HelperImport {
  file: string;
  symbols: string[];
}

/**
 * Value imports (or re-exports) of files that belong to another manager or to
 * the shared `manager/util.ts`. Type-only imports cannot emit anything.
 */
function getHelperImports(file: string, content: string): HelperImport[] {
  const managerDir = upath.join(managerRoot, file.split('/')[3]);
  const result: HelperImport[] = [];
  for (const match of content.matchAll(
    regEx(
      /\b(?:import|export)\s+(?<clause>\*\s+as\s+\w+|\{[^}]*\})\s+from\s+'(?<specifier>\.\.?\/[^']+\.ts)'/g,
    ),
  )) {
    const { clause, specifier } = match.groups!;
    const resolved = upath.normalize(
      upath.join(upath.dirname(file), specifier),
    );
    if (
      !resolved.startsWith(`${managerRoot}/`) ||
      resolved.startsWith(`${managerDir}/`) ||
      upath.basename(resolved) === 'types.ts'
    ) {
      continue;
    }
    const symbols = clause.startsWith('{')
      ? clause
          .slice(1, -1)
          .split(',')
          .map((symbol) => symbol.trim())
          .filter((symbol) => symbol && !symbol.startsWith('type '))
          .map((symbol) => symbol.split(regEx(/\s+as\s+/))[0])
      : ['*'];
    result.push({ file: resolved, symbols });
  }
  return result;
}

interface EmittedDatasources {
  emitted: string[];
  unknownHelpers: string[];
}

async function getEmittedDatasources(
  manager: string,
  classIds: Map<string, string>,
): Promise<EmittedDatasources> {
  const emitted = new Set<string>();
  const unknownHelpers = new Set<string>();
  for (const file of await listSourceFiles(upath.join(managerRoot, manager))) {
    const content = await fs.readFile(file, 'utf8');
    for (const id of extractDatasourceIds(content, classIds)) {
      emitted.add(id);
    }
    for (const helper of getHelperImports(file, content)) {
      const helperIds = extractDatasourceIds(
        await fs.readFile(helper.file, 'utf8'),
        classIds,
      );
      if (helperIds.size === 0) {
        continue;
      }
      for (const symbol of helper.symbols) {
        const key = `${helper.file}#${symbol}`;
        const ids = helperDatasources[key];
        if (!ids) {
          unknownHelpers.add(key);
          continue;
        }
        for (const id of ids === '*' ? helperIds : ids) {
          emitted.add(id);
        }
      }
    }
  }
  return {
    emitted: [...emitted].sort(),
    unknownHelpers: [...unknownHelpers].sort(),
  };
}

describe('other/validate-supported-datasources', () => {
  const classIds = getDatasourceClassIds();

  // custom managers support every datasource and declare `['*']`
  for (const manager of getManagerList()) {
    it(`${manager} declares every datasource it can emit`, async () => {
      const declared: string[] = get(manager, 'supportedDatasources')!;

      const { emitted, unknownHelpers } = await getEmittedDatasources(
        manager,
        classIds,
      );
      const undeclared = emitted.filter((id) => !declared.includes(id));

      // add new cross-manager helpers to `helperDatasources` above
      expect(unknownHelpers).toBeEmpty();
      expect(emitted).not.toBeEmpty();
      expect(undeclared).toBeEmpty();
    });
  }
});
