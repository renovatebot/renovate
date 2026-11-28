import { z } from 'zod/v4';
import { Toml } from '../../../util/schema-utils/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { normalizePythonDepName } from '../../datasource/pypi/common.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import type { PackageDependency } from '../types.ts';

/**
 * Locked packages of a PEP 751 `pylock.toml` file.
 *
 * Git packages are mapped like the `pip_requirements` manager does it, the lock file pins them to a `commit-id`.
 * Other packages without a `version`, such as directory packages, are skipped.
 */
export const PylockToml = Toml.pipe(
  z
    .object({
      packages: z.array(
        z.object({
          name: z.string(),
          version: z.string().optional(),
          vcs: z
            .object({
              type: z.string(),
              url: z.string().optional(),
              'commit-id': z.string(),
            })
            .optional(),
        }),
      ),
    })
    .transform(({ packages }): PackageDependency[] =>
      packages.flatMap(({ name, version, vcs }): PackageDependency[] => {
        if (vcs) {
          if (vcs.type !== 'git' || !vcs.url) {
            return [];
          }
          return [
            {
              datasource: GitTagsDatasource.id,
              depName: name,
              packageName: vcs.url,
              currentValue: vcs['commit-id'],
              currentVersion: vcs['commit-id'],
            },
          ];
        }
        if (!version) {
          return [];
        }
        return [
          {
            datasource: PypiDatasource.id,
            depName: name,
            packageName: normalizePythonDepName(name),
            currentVersion: version,
          },
        ];
      }),
    ),
);
