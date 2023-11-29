import { z } from 'zod';

export const Step = z.object({
  task: z.string(),
});
export type Step = z.infer<typeof Step>;

export const Job = z.object({
  steps: z.array(Step),
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
    strategy: z.object({
      runOnce: Deploy,
      rolling: Deploy,
      canary: Deploy,
    }),
  })
  .partial();
export type Deployment = z.infer<typeof Deployment>;

export const Jobs = z.array(z.union([Job, Deployment]));
export type Jobs = z.infer<typeof Jobs>;

export const Stage = z.object({
  jobs: Jobs,
});
export type Stage = z.infer<typeof Stage>;

export const Container = z.object({
  image: z.string().optional(),
});
export type Container = z.infer<typeof Container>;

export const Repository = z.object({
  type: z.enum(['git', 'github', 'bitbucket']),
  name: z.string(),
  ref: z.string().optional(),
});
export type Repository = z.infer<typeof Repository>;

export const Resources = z
  .object({
    repositories: z.array(Repository),
    containers: z.array(Container),
  })
  .partial();
export type Resources = z.infer<typeof Resources>;

export const AzurePipelines = z
  .object({
    resources: Resources,
    stages: z.array(Stage),
    jobs: z.array(Jobs),
    steps: z.array(Step),
  })
  .partial();
export type AzurePipelines = z.infer<typeof AzurePipelines>;
