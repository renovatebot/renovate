import { z } from 'zod';

const DockerComposeService = z.object({
  image: z.string().optional(),
  build: z
    .union([
      z.string(),
      z.object({
        context: z.string().optional(),
        dockerfile: z.string().optional(),
      }),
    ])
    .optional(),
});

const DockerComposeFileV1 = z.record(DockerComposeService);
const DockerComposeFileModern = z.object({
  // compose does not use this strictly, so we shouldn't be either
  // https://docs.docker.com/compose/compose-file/04-version-and-name/#version-top-level-element
  version: z.string().optional(),
  services: z.record(DockerComposeService),
});

export const DockerComposeFile =
  DockerComposeFileModern.or(DockerComposeFileV1);
export type DockerComposeFile = z.infer<typeof DockerComposeFile>;
