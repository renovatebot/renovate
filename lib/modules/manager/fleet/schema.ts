import { z } from 'zod';

const FleetHelmBlock = z.object({
  chart: z.string().optional(),
  repo: z.string().optional(),
  version: z.string().optional(),
  releaseName: z.string().optional(),
});
export type FleetHelmBlock = z.infer<typeof FleetHelmBlock>;

/**
  Represent a GitRepo Kubernetes manifest of Fleet.
  @link https://fleet.rancher.io/gitrepo-add/#create-gitrepo-instance
 */
export const GitRepo = z.object({
  metadata: z.object({
    name: z.string(),
  }),
  kind: z.string(),
  spec: z.object({
    repo: z.string().optional(),
    revision: z.string().optional(),
  }),
});
export type GitRepo = z.infer<typeof GitRepo>;

/**
 Represent a Bundle configuration of Fleet, which is located in `fleet.yaml` files.
 @link https://fleet.rancher.io/gitrepo-structure/#fleetyaml
 */
export const FleetFile = z.object({
  helm: FleetHelmBlock,
  targetCustomizations: z
    .array(
      z.object({
        name: z.string(),
        helm: FleetHelmBlock.partial().optional(),
      }),
    )
    .optional(),
});
export type FleetFile = z.infer<typeof FleetFile>;
