import { z } from 'zod/v4';
import { regEx } from '../../../util/regex.ts';
import { LooseArray, Yaml } from '../../../util/schema-utils/index.ts';

const templateExpressionRegex = regEx(/^\$\{\{.+\}\}$/);

export function isTemplateExprNode<T>(
  obj: TemplateExpressionArrayValue<T>,
): obj is Record<string, TemplateExpressionArrayValue<T>[]> {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    !Array.isArray(obj) &&
    Object.keys(obj).length === 1 &&
    templateExpressionRegex.test(Object.keys(obj)[0].trim())
  );
}

export type TemplateExpressionArrayValue<T> =
  | T
  | Record<string, TemplateExpressionArrayValue<T>[]>;

function withTemplateExpr<T>(
  schema: z.ZodType<T>,
): z.ZodType<TemplateExpressionArrayValue<T>> {
  const combined: z.ZodType<TemplateExpressionArrayValue<T>> = z.lazy(() =>
    z.union([
      z.record(z.string(), LooseArray(combined)).refine(isTemplateExprNode),
      schema,
    ]),
  );
  return combined;
}

export const Task = withTemplateExpr(z.object({ task: z.string() }));
export type Task = TemplateExpressionArrayValue<{ task: string }>;

export const Job = withTemplateExpr(
  z.object({
    steps: LooseArray(Task), // drop alias step
  }),
);
export type Job = TemplateExpressionArrayValue<{ steps: Task[] }>;

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

export const Deployment = withTemplateExpr(
  z
    .object({
      strategy: z
        .object({
          runOnce: Deploy,
          rolling: Deploy,
          canary: Deploy,
        })
        .partial(),
    })
    .partial(),
);
export type Deployment = TemplateExpressionArrayValue<{
  strategy?: {
    runOnce?: Deploy;
    rolling?: Deploy;
    canary?: Deploy;
  };
}>;

export const Jobs = z.array(z.union([Job, Deployment]));
export type Jobs = (Job | Deployment)[];

export const Stage = withTemplateExpr(z.object({ jobs: Jobs }));
export type Stage = TemplateExpressionArrayValue<{ jobs: Jobs }>;

export const Stages = z.array(Stage);
export type Stages = Stage[];

export const Container = withTemplateExpr(z.object({ image: z.string() }));
export type Container = TemplateExpressionArrayValue<{ image: string }>;

export const Containers = LooseArray(Container);
export type Containers = Container[];

export const Repository = z.object({
  type: z.enum(['git', 'github', 'bitbucket']),
  name: z.string(),
  ref: z.string().optional(),
});
export type Repository = z.infer<typeof Repository>;

export const Repositories = LooseArray(Repository);
export type Repositories = Repository[];

export const Resources = z
  .object({
    repositories: Repositories,
    containers: Containers,
  })
  .partial();
export type Resources = z.infer<typeof Resources>;

export const AzurePipelines = z
  .object({
    resources: Resources,
    stages: Stages,
    jobs: Jobs,
    steps: LooseArray(Task), // drop alias step
  })
  .partial();
export type AzurePipelines = z.infer<typeof AzurePipelines>;

export const AzurePipelinesYaml = Yaml.pipe(AzurePipelines);
