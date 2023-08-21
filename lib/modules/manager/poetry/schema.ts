import { ZodEffects, ZodType, ZodTypeDef, z } from 'zod';
import { parseGitUrl } from '../../../util/git/url';
import { regEx } from '../../../util/regex';
import { LooseArray, LooseRecord, Toml } from '../../../util/schema-utils';
import { uniq } from '../../../util/uniq';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { PypiDatasource } from '../../datasource/pypi';
import * as pep440Versioning from '../../versioning/pep440';
import * as poetryVersioning from '../../versioning/poetry';
import type { PackageDependency, PackageFileContent } from '../types';

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
      if (!currentValue) {
        return { datasource: PypiDatasource.id };
      }

      return {
        datasource: PypiDatasource.id,
        managerData: { nestedVersion: true },
        currentValue,
      };
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
)
  .transform((record) => {
    const deps: PackageDependency[] = [];
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
      deps.push(dep);
    }
    return deps;
  })
  .catch([]);
export type PoetryDependencyRecord = z.infer<typeof PoetryDependencyRecord>;

function withDepType<
  Output extends PackageDependency[],
  Schema extends ZodType<Output, ZodTypeDef, unknown>
>(schema: Schema, depType: string): ZodEffects<Schema> {
  return schema.transform((deps) => {
    for (const dep of deps) {
      dep.depType = depType;
    }
    return deps;
  });
}

export const PoetryGroupRecord = LooseRecord(
  z.string(),
  z
    .object({ dependencies: PoetryDependencyRecord })
    .transform(({ dependencies }) => dependencies)
)
  .transform((record) => {
    const deps: PackageDependency[] = [];
    for (const [groupName, group] of Object.entries(record)) {
      for (const dep of Object.values(group)) {
        dep.depType = groupName;
        deps.push(dep);
      }
    }
    return deps;
  })
  .catch([]);

export type PoetryGroupRecord = z.infer<typeof PoetryGroupRecord>;

export const PoetrySectionSchema = z
  .object({
    dependencies: withDepType(PoetryDependencyRecord, 'dependencies'),
    'dev-dependencies': withDepType(PoetryDependencyRecord, 'dev-dependencies'),
    extras: withDepType(PoetryDependencyRecord, 'extras'),
    group: PoetryGroupRecord,
    source: LooseArray(
      z.object({ url: z.string() }).transform(({ url }) => url)
    )
      .refine((urls) => urls.length > 0)
      .transform((urls) => [
        ...urls,
        process.env.PIP_INDEX_URL ?? 'https://pypi.org/pypi/',
      ])
      .transform((urls) => uniq(urls))
      .optional()
      .catch(undefined),
  })
  .transform(
    ({
      dependencies,
      'dev-dependencies': devDependencies,
      extras,
      group,
      source,
    }) => {
      const deps: PackageDependency[] = [
        ...dependencies,
        ...devDependencies,
        ...extras,
        ...group,
      ];

      const res: PackageFileContent = { deps };

      if (source) {
        res.registryUrls = source;
      }

      return res;
    }
  );

export type PoetrySectionSchema = z.infer<typeof PoetrySectionSchema>;

export const PoetrySchema = z
  .object({
    tool: z
      .object({ poetry: PoetrySectionSchema })
      .transform(({ poetry }) => poetry),
    'build-system': z
      .object({
        requires: z.array(z.string()),
        'build-backend': z.string().optional(),
      })
      .optional(),
  })
  .transform(({ tool }) => tool);

export type PoetrySchema = z.infer<typeof PoetrySchema>;

export const PoetrySchemaToml = Toml.pipe(PoetrySchema);
