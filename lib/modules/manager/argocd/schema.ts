import { z } from 'zod';

export const KubernetesResource = z.object({
  apiVersion: z.string(),
});

export const ApplicationSource = z.object({
  chart: z.string().optional(),
  repoURL: z.string(),
  targetRevision: z.string(),
});
export type ApplicationSource = z.infer<typeof ApplicationSource>;

export const ApplicationSpec = z.object({
  source: ApplicationSource.optional(),
  sources: z.array(ApplicationSource).optional(),
});
export type ApplicationSpec = z.infer<typeof ApplicationSpec>;

export const Application = KubernetesResource.extend({
  kind: z.literal('Application'),
  spec: ApplicationSpec,
});

export const ApplicationSet = KubernetesResource.extend({
  kind: z.literal('ApplicationSet'),
  spec: z.object({
    template: z.object({
      spec: ApplicationSpec,
    }),
  }),
});

export const ApplicationDefinition = Application.or(ApplicationSet);
export type ApplicationDefinition = z.infer<typeof ApplicationDefinition>;
