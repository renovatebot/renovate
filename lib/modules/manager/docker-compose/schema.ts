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
    /**
     *  compose does not use this strictly, so we shouldn't be either
     *  https://docs.docker.com/compose/compose-file/04-version-and-name/#version-top-level-element
     */
    version: z.string().optional(),
    services: z.record(DockerComposeService),
  })
  // using catchall to capture fields starting with `x-` and collecting them in `extensions` field
  // might need to replace this with something better once zod v4 is stable
  .catchall(z.unknown())
  .transform(
    (
      obj,
    ): {
      version?: string;
      services: Record<string, z.infer<typeof DockerComposeService>>;
      extensions?: Record<string, { image: string }>;
    } => {
      const { version, services, ...rest } = obj;

      let extensions: Record<string, { image: string }> | undefined;

      // collect extensions which have image field
      // https://docs.docker.com/reference/compose-file/extensions/
      for (const key in rest) {
        if (key.startsWith('x-')) {
          const value = rest[key];
          if (is.object(value) && 'image' in value && is.string(value.image)) {
            extensions ??= {};
            extensions[key] = { image: value.image };
          }
        }
      }

      return {
        version,
        services,
        ...(extensions && { extensions }),
      };
    },
  );

export const DockerComposeFile = z.union([
  DockerComposeFileModern,
  DockerComposeFileV1,
]);
export type DockerComposeFile = z.infer<typeof DockerComposeFile>;
