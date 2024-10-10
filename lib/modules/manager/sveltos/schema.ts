import { z } from 'zod';
import { LooseArray } from '../../../util/schema-utils';
import { KubernetesResource } from '../flux/schema';

export const SveltosHelmSource = z.object({
  repositoryURL: z.string(),
  repositoryName: z.string(),
  chartName: z.string(),
  chartVersion: z.string(),
});

export type SveltosHelmSource = z.infer<typeof SveltosHelmSource>;

export const SveltosHelmSpec = z.object({
  helmCharts: LooseArray(SveltosHelmSource).optional(),
});
export type SveltosHelmSpec = z.infer<typeof SveltosHelmSpec>;

export const ClusterProfile = KubernetesResource.extend({
  apiVersion: z.string().startsWith('config.projectsveltos.io/'),
  kind: z.literal('ClusterProfile'),
  spec: SveltosHelmSpec,
});

export const Profile = KubernetesResource.extend({
  apiVersion: z.string().startsWith('config.projectsveltos.io/'),
  kind: z.literal('Profile'),
  spec: SveltosHelmSpec,
});

export const EventTrigger = KubernetesResource.extend({
  apiVersion: z.string().startsWith('lib.projectsveltos.io/'),
  kind: z.literal('EventTrigger'),
  spec: SveltosHelmSpec,
});

// Create a union schema for ProfileDefinition
export const ProfileDefinition = z.union([
  Profile,
  ClusterProfile,
  EventTrigger,
]);
export type ProfileDefinition = z.infer<typeof ProfileDefinition>;
