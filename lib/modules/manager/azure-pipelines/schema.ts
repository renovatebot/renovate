import { z } from 'zod/v4';
import { regEx } from '../../../util/regex.ts';
import { LooseArray, Yaml } from '../../../util/schema-utils/index.ts';

const templateExpressionRegex = regEx(/^\$\{\{.+\}\}$/);

function isTemplateExpression(key: string): boolean {
  return templateExpressionRegex.test(key.trim());
}

/**
 * Works like `LooseArray`, but additionally expands template expression nodes
 * such as `- ${{ if eq(variables.foo, 'bar') }}:` into the elements of their
 * nested list, at any depth, so consumers only see plain elements.
 *
 * https://learn.microsoft.com/azure/devops/pipelines/process/expressions#conditional-insertion
 *
 * @param Elem Schema for array elements
 * @returns Schema for a flat array of elements
 */
function TemplateExpressionArray<Schema extends z.ZodTypeAny>(
  Elem: Schema,
): z.ZodType<z.TypeOf<Schema>[], any> {
  // An element expands to zero or more items: a template expression node
  // expands to the items of its nested lists, anything else to itself.
  // The `refine` is required to not mistake an element whose every value is a
  // list, such as `- jobs: [...]`, for a template expression node.
  const Item: z.ZodType<z.TypeOf<Schema>[], any> = z.lazy(() =>
    z.union([
      z
        .record(z.string(), Items)
        .refine((node) => Object.keys(node).every(isTemplateExpression))
        .transform((node) => Object.values(node).flat()),
      Elem.transform((item: z.TypeOf<Schema>) => [item]),
    ]),
  );

  const Items: z.ZodType<z.TypeOf<Schema>[], any> = LooseArray(Item).transform(
    (items) => items.flat(),
  );

  return Items;
}

export const Step = z.object({
  task: z.string(),
});
export type Step = z.infer<typeof Step>;

export const Steps = TemplateExpressionArray(Step); // drops alias steps
export type Steps = z.infer<typeof Steps>;

export const Job = z.object({
  steps: Steps,
});
export type Job = z.infer<typeof Job>;

export const Deploy = z
  .object({
    deploy: Job,
    preDeploy: Job,
    routeTraffic: Job,
    postRouteTraffic: Job,
    on: z
      .object({
        failure: Job,
        success: Job,
      })
      .partial(),
  })
  .partial();
export type Deploy = z.infer<typeof Deploy>;

export const Deployment = z
  .object({
    strategy: z
      .object({
        runOnce: Deploy,
        rolling: Deploy,
        canary: Deploy,
      })
      .partial(),
  })
  .partial();
export type Deployment = z.infer<typeof Deployment>;

export const Jobs = TemplateExpressionArray(z.union([Job, Deployment]));
export type Jobs = z.infer<typeof Jobs>;

export const Stage = z.object({
  jobs: Jobs,
});
export type Stage = z.infer<typeof Stage>;

export const Stages = TemplateExpressionArray(Stage);
export type Stages = z.infer<typeof Stages>;

export const Container = z.object({
  image: z.string(),
});
export type Container = z.infer<typeof Container>;

export const Containers = TemplateExpressionArray(Container);
export type Containers = z.infer<typeof Containers>;

export const Repository = z.object({
  type: z.enum(['git', 'github', 'bitbucket']),
  name: z.string(),
  ref: z.string().optional(),
});
export type Repository = z.infer<typeof Repository>;

export const Resources = z
  .object({
    repositories: LooseArray(Repository),
    containers: Containers,
  })
  .partial();
export type Resources = z.infer<typeof Resources>;

export const AzurePipelines = z
  .object({
    resources: Resources,
    stages: Stages,
    jobs: Jobs,
    steps: Steps,
  })
  .partial();
export type AzurePipelines = z.infer<typeof AzurePipelines>;

export const AzurePipelinesYaml = Yaml.pipe(AzurePipelines);
