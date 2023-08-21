import { z } from 'zod';
import { parseGitUrl } from '../../../util/git/url';
import { regEx } from '../../../util/regex';
import { LooseRecord, Toml } from '../../../util/schema-utils';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { PypiDatasource } from '../../datasource/pypi';
import * as pep440Versioning from '../../versioning/pep440';
import * as poetryVersioning from '../../versioning/poetry';
import type { PackageDependency } from '../types';

const PoetryPathDependency = z
  .object({
    path: z.string(),
    version: z.string().optional().catch(undefined),
  })
  .transform(({ version }): PackageDependency => {
    const dep: PackageDependency = {
      datasource: PypiDatasource.id,
      skipReason: 'path-dependency',
    };

    if (version) {
      dep.currentValue = version;
    }

    return dep;
  });

const PoetryGitDependency = z
  .object({
    git: z.string(),
    tag: z.string().optional().catch(undefined),
  })
  .transform(({ git, tag }): PackageDependency => {
    if (!tag) {
      return {
        datasource: GitRefsDatasource.id,
        packageName: git,
        skipReason: 'git-dependency',
      };
    }

    const parsedUrl = parseGitUrl(git);
    if (parsedUrl.source !== 'github.com') {
      return {
        datasource: GitRefsDatasource.id,
        currentValue: tag,
        packageName: git,
        skipReason: 'git-dependency',
      };
    }

    const { owner, name } = parsedUrl;
    const repo = `${owner}/${name}`;
    return {
      datasource: GithubTagsDatasource.id,
      currentValue: tag,
      packageName: repo,
    };
  });

const PoetryPypiDependency = z.union([
  z
    .object({ version: z.string().optional() })
    .transform(({ version: currentValue }): PackageDependency => {
      const dep: PackageDependency = {
        datasource: PypiDatasource.id,
        managerData: { nestedVersion: true },
      };

      if (currentValue) {
        dep.currentValue = currentValue;
      }

      return dep;
    }),
  z.string().transform(
    (version): PackageDependency => ({
      datasource: PypiDatasource.id,
      currentValue: version,
      managerData: { nestedVersion: false },
    })
  ),
]);

const PoetryDependencySchema = z.union([
  PoetryPathDependency,
  PoetryGitDependency,
  PoetryPypiDependency,
]);

const PoetryArraySchema = z.array(z.unknown()).transform(
  (): PackageDependency => ({
    datasource: PypiDatasource.id,
    skipReason: 'multiple-constraint-dep',
  })
);

const PoetryValue = z.union([PoetryDependencySchema, PoetryArraySchema]);
type PoetryValue = z.infer<typeof PoetryValue>;

export const PoetryDependencyRecord = LooseRecord(
  z.string(),
  PoetryValue.transform((dep) => {
    if (dep.skipReason) {
      return dep;
    }

    // istanbul ignore if: should never happen
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
  })
).transform((record) => {
  for (const [depName, dep] of Object.entries(record)) {
    dep.depName = depName;
    if (!dep.packageName) {
      const pep503NormalizeRegex = regEx(/[-_.]+/g);
      const packageName = depName
        .toLowerCase()
        .replace(pep503NormalizeRegex, '-');
      if (depName !== packageName) {
        dep.packageName = packageName;
      }
    }
  }
  return record;
});

export type PoetryDependencyRecord = z.infer<typeof PoetryDependencyRecord>;

export const PoetryGroupRecord = LooseRecord(
  z.string(),
  z.object({
    dependencies: PoetryDependencyRecord.optional(),
  })
);

export type PoetryGroupRecord = z.infer<typeof PoetryGroupRecord>;

export const PoetrySectionSchema = z.object({
  dependencies: PoetryDependencyRecord.optional(),
  'dev-dependencies': PoetryDependencyRecord.optional(),
  extras: PoetryDependencyRecord.optional(),
  group: PoetryGroupRecord.optional(),
  source: z
    .array(z.object({ name: z.string(), url: z.string().optional() }))
    .optional(),
});

export type PoetrySectionSchema = z.infer<typeof PoetrySectionSchema>;

export const PoetrySchema = z.object({
  tool: z
    .object({
      poetry: PoetrySectionSchema.optional(),
    })
    .optional(),
  'build-system': z
    .object({
      requires: z.array(z.string()),
      'build-backend': z.string().optional(),
    })
    .optional(),
});

export type PoetrySchema = z.infer<typeof PoetrySchema>;

export const PoetrySchemaToml = Toml.pipe(PoetrySchema);
