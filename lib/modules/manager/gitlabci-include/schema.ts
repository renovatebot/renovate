import { z } from 'zod';
import { toArray } from '../../../util/array';
import { LooseArray } from '../../../util/schema-utils';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import type { PackageDependency } from '../types';

const GitlabInclude = z
  .object({
    project: z.string(),
    ref: z.string().optional().catch(undefined),
  })
  .transform(({ project, ref }) => {
    const dep: PackageDependency = {
      datasource: GitlabTagsDatasource.id,
      depName: project,
      depType: 'repository',
    };

    if (!ref) {
      dep.skipReason = 'unspecified-version';
      return dep;
    }

    dep.currentValue = ref;
    return dep;
  });

const GitlabIncludes = z
  .union([GitlabInclude.transform(toArray), LooseArray(GitlabInclude)])
  .catch([]);

const GitlabRecord = z.record(z.unknown()).transform((obj) => {
  const { include, ...rest } = obj;
  const children = Object.values(rest);
  return { include, children };
});

export const GitlabDocument = z
  .union([GitlabRecord.transform(toArray), LooseArray(GitlabRecord)])
  .transform((docs): PackageDependency[] =>
    docs
      .map(({ include, children }) => {
        const deps = GitlabIncludes.parse(include);
        const childrenDeps = GitlabDocumentArray.parse(children);
        return [...childrenDeps, ...deps];
      })
      .flat(),
  );

export const GitlabDocumentArray = LooseArray(GitlabDocument)
  .transform((x) => x.flat())
  .catch([]);
