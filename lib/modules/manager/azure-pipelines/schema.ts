import { z } from 'zod/v4';
import { regEx } from '../../../util/regex.ts';
import { LooseArray, Yaml } from '../../../util/schema-utils/index.ts';

const templateExpressionRegex = regEx(/^\$\{\{.+\}\}$/);

export function isTemplateExprNode(
  obj: unknown,
): obj is Record<string, unknown[]> {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    !Array.isArray(obj) &&
    Object.keys(obj).length === 1 &&
    templateExpressionRegex.test(Object.keys(obj)[0].trim())
  );
}

function withTemplateExpr(schema: z.ZodType<any>): z.ZodType<any> {
  const combined: z.ZodType<any> = z.lazy(() =>
    z.union([
      z.record(z.string(), z.array(combined)).refine(isTemplateExprNode),
      schema,
    ]),
  );
  return combined;
}

export const Step = withTemplateExpr(z.object({ task: z.string() }));
export type Step = { task: string } | Record<string, Step[]>;

export const Job = withTemplateExpr(
  z.object({
    steps: LooseArray(Step),
  }),
);
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
export type Deployment = z.infer<typeof Deployment>;

export const Jobs = LooseArray(z.union([Job, Deployment]));
export type Jobs = z.infer<typeof Jobs>;

export const Stage = withTemplateExpr(z.object({ jobs: Jobs }));
export type Stage = z.infer<typeof Stage>;

export const Container = withTemplateExpr(z.object({ image: z.string() }));
export type Container = z.infer<typeof Container>;

export const Repository = z.object({
  type: z.enum(['git', 'github', 'bitbucket']),
  name: z.string(),
  ref: z.string().optional(),
});
export type Repository = z.infer<typeof Repository>;

export const Resources = z
  .object({
    repositories: LooseArray(Repository),
    containers: LooseArray(Container),
  })
  .partial();
export type Resources = z.infer<typeof Resources>;

export const AzurePipelines = z
  .object({
    resources: Resources,
    stages: LooseArray(Stage),
    jobs: Jobs,
    steps: LooseArray(Step),
  })
  .partial();
export type AzurePipelines = z.infer<typeof AzurePipelines>;

export const AzurePipelinesYaml = Yaml.pipe(AzurePipelines);
