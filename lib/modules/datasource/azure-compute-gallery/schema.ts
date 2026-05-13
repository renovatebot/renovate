import { z } from 'zod/v3';
import { Json, LooseArray } from '../../../util/schema-utils/index.ts';
import { MaybeTimestamp } from '../../../util/timestamp.ts';
import type { Release } from '../types.ts';

const NonEmptyString = z.string().min(1);

export const AzureComputeGalleryPackage = Json.pipe(
  z.object({
    subscriptionId: NonEmptyString,
    resourceGroupName: NonEmptyString,
    galleryName: NonEmptyString,
    galleryImageName: NonEmptyString,
  }),
);
export type AzureComputeGalleryPackage = z.infer<
  typeof AzureComputeGalleryPackage
>;

const AzureComputeGalleryVersion = z
  .object({
    name: NonEmptyString,
    properties: z.object({
      publishingProfile: z.object({
        publishedDate: MaybeTimestamp,
        excludeFromLatest: z
          .boolean()
          .nullish()
          .refine((excludeFromLatest) => excludeFromLatest !== true),
      }),
    }),
  })
  .transform(({ name: version, properties }) => {
    const release: Release = { version };

    const releaseTimestamp = properties.publishingProfile.publishedDate;
    if (releaseTimestamp) {
      release.releaseTimestamp = releaseTimestamp;
    }

    return release;
  });

export const AzureComputeGalleryVersions = z.object({
  value: LooseArray(AzureComputeGalleryVersion).catch([]),
  nextLink: z.string().url().optional().catch(undefined),
});
export type AzureComputeGalleryVersions = z.infer<
  typeof AzureComputeGalleryVersions
>;
