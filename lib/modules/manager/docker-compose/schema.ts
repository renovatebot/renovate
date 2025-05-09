import is from '@sindresorhus/is';
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
const DockerComposeFileModern = z
  .object({
    // compose does not use this strictly, so we shouldn't be either
    // https://docs.docker.com/compose/compose-file/04-version-and-name/#version-top-level-element
    version: z.string().optional(),
    services: z.record(DockerComposeService),
  })
  .catchall(z.unknown()) // allow unknown fields
  .transform(
    (
      obj,
    ): {
      version?: string;
      services: Record<string, z.infer<typeof DockerComposeService>>;
      fragments?: Record<string, z.infer<typeof DockerComposeService>>;
    } => {
      const { version, services, ...rest } = obj;

      let fragments:
        | Record<string, z.infer<typeof DockerComposeService>>
        | undefined = undefined;

      // collect fragments which have image field
      // https://docs.docker.com/reference/compose-file/fragments/
      // https://docs.docker.com/reference/compose-file/extensions/
      for (const key in rest) {
        if (key.startsWith('x-')) {
          const value = rest[key];
          if (is.object(value) && 'image' in value && is.string(value.image)) {
            fragments ??= {};
            fragments[key] = value as z.infer<typeof DockerComposeService>;
          }
        }
      }

      return {
        version,
        services,
        ...(fragments && { fragments }),
      };
    },
  );

export const DockerComposeFile = z.union([
  DockerComposeFileModern,
  DockerComposeFileV1,
]);
export type DockerComposeFile = z.infer<typeof DockerComposeFile>;
