import { z } from 'zod';
import { toArray } from '../../../util/array';
import { LooseArray, LooseRecord } from '../../../util/schema-utils';
import { trimLeadingSlash } from '../../../util/url';

const LocalInclude = z
  .union([
    z.string(),
    z.object({ local: z.string() }).transform(({ local }) => local),
  ])
  .transform(trimLeadingSlash);

const DocumentLocalIncludes = z
  .object({
    include: z.union([
      LooseArray(LocalInclude),
      LocalInclude.transform(toArray),
    ]),
  })
  .transform(({ include }) => include);

export const MultiDocumentLocalIncludes = LooseArray(
  DocumentLocalIncludes,
).transform((includes) => includes.flat());

export const Job = z.object({
  image: z
    .union([
      z.string().transform((image) => ({
        type: 'image' as const,
        value: image,
      })),
      z.object({ name: z.string() }).transform(({ name }) => ({
        type: 'image-name' as const,
        value: name,
      })),
    ])
    .optional()
    .catch(undefined),
  services: LooseArray(
    z.union([
      z.string(),
      z.object({ name: z.string() }).transform(({ name }) => name),
    ]),
  ).catch([]),
});

export const Jobs = LooseRecord(z.string(), Job)
  .catch({})
  .transform((x) => Object.values(x));

const GitlabInclude = z
  .object({ component: z.string() })
  .transform(({ component }) => component);

const GitlabIncludes = z
  .union([LooseArray(GitlabInclude), GitlabInclude.transform(toArray)])
  .catch([]);

export const GitlabDocument = z
  .record(z.unknown())
  .transform((obj) => {
    const { include, ...rest } = obj;
    const children = Object.values(rest);
    return { include, children };
  })
  .transform(({ include, children }): string[] => [
    ...GitlabDocumentArray.parse(children),
    ...GitlabIncludes.parse(include),
  ]);

const GitlabDocumentArray = LooseArray(GitlabDocument).transform((x) =>
  x.flat(),
);
