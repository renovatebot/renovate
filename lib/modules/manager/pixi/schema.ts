import { z } from 'zod';
import {
  LooseRecord,
  Toml,
  withDepType,
  Yaml,
} from '../../../util/schema-utils';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { PypiDatasource } from '../../datasource/pypi';
import { normalizePythonDepName } from '../../datasource/pypi/common';
import * as gitVersioning from '../../versioning/git';
import * as pep440Versioning from '../../versioning/pep440';
import * as poetryVersioning from '../../versioning/poetry';
import type { PackageDependency } from '../types';

const PixiPathDependency = z
  .object({
    path: z.string(),
  })
  .transform(({}): PackageDependency => {
    const dep: PackageDependency = {
      datasource: PypiDatasource.id,
      skipReason: 'path-dependency',
    };

    return dep;
  });

const PixiGitDependency = z
  .object({
    git: z.string(),
    rev: z.string().optional().catch(undefined),
  })
  .transform(({ git, rev }): PackageDependency => {
    if (rev) {
      return {
        datasource: GitRefsDatasource.id,
        currentValue: rev,
        currentDigest: rev,
        replaceString: rev,
        packageName: git,
      };
    }

    return {
      datasource: GitRefsDatasource.id,
      currentValue: 'HEAD',
      packageName: git,
      skipReason: 'git-dependency',
    };
  });

const PixiPypiDependency = z.union([
  z
    .object({ version: z.string().optional() })
    .transform(({ version: currentValue }): PackageDependency => {
      if (!currentValue) {
        return { datasource: PypiDatasource.id };
      }

      return {
        datasource: PypiDatasource.id,
        managerData: {
          nestedVersion: true,
        },
        currentValue,
      };
    }),
  z.string().transform(
    (version): PackageDependency => ({
      datasource: PypiDatasource.id,
      currentValue: version,
      managerData: { nestedVersion: false },
    }),
  ),
]);

const PypiDependency = z.union([
  PixiPathDependency,
  PixiGitDependency,
  PixiPypiDependency,
]);

export const PoetryDependencies = LooseRecord(
  z.string(),
  PypiDependency.transform((dep) => {
    if (dep.skipReason) {
      return dep;
    }

    if (dep.datasource === GitRefsDatasource.id && dep.currentDigest) {
      dep.versioning = gitVersioning.id;
      return dep;
    }

    // istanbul ignore if: normaly should not happen
    if (!dep.currentValue) {
      dep.skipReason = 'unspecified-version';
      return dep;
    }

    if (pep440Versioning.isValid(dep.currentValue)) {
      dep.versioning = pep440Versioning.id;
      return dep;
    }

    if (poetryVersioning.isValid(dep.currentValue)) {
      dep.versioning = poetryVersioning.id;
      return dep;
    }

    dep.skipReason = 'invalid-version';
    return dep;
  }),
).transform((record) => {
  const deps: PackageDependency[] = [];
  for (const [depName, dep] of Object.entries(record)) {
    dep.depName = depName;
    if (!dep.packageName) {
      const packageName = normalizePythonDepName(depName);
      if (depName !== packageName) {
        dep.packageName = packageName;
      }
    }
    deps.push(dep);
  }
  return deps;
});

export const PixiConfigSchema = z
  .object({
    // TODO: support full conda version
    // we currently only parse python from it
    dependencies: LooseRecord(z.string(), z.string()),
    'pypi-dependencies': withDepType(
      PoetryDependencies,
      'pypi-dependencies',
      false,
    ).optional(),
  })
  .transform(
    ({ 'pypi-dependencies': pypiDeps = [], dependencies: condaDeps }) => {
      return { pypiDeps, condaDeps };
    },
  );

export const PixiSchemaToml = Toml.pipe(PixiConfigSchema);

export const LockfileYaml = Yaml.pipe(
  z.object({
    version: z.number(),
  }),
);
