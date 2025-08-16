import { z } from 'zod';
import { LooseArray, multidocYaml } from '../../../util/schema-utils';

export const KubernetesResource = z.object({
  apiVersion: z.string(),
});

export const ApplicationKustomize = z.object({
  images: LooseArray(z.string()).optional(),
});
export const ApplicationSource = z.object({
  chart: z.string().optional(),
  repoURL: z.string(),
  targetRevision: z.string(),
  kustomize: ApplicationKustomize.optional(),
});
export type ApplicationSource = z.infer<typeof ApplicationSource>;

export const ApplicationSpec = z.object({
  source: ApplicationSource.optional(),
  sources: LooseArray(ApplicationSource).optional(),
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

export const ApplicationDefinitions = multidocYaml({
  removeTemplates: true,
}).pipe(LooseArray(ApplicationDefinition));
