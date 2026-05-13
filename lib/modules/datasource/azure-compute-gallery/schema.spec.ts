import {
  AzureComputeGalleryPackage,
  AzureComputeGalleryVersions,
} from './schema.ts';

describe('modules/datasource/azure-compute-gallery/schema', () => {
  describe('AzureComputeGalleryPackage', () => {
    it.each`
      input                                                                                                    | expected
      ${{ subscriptionId: 'sub', resourceGroupName: 'rg', galleryName: 'gallery', galleryImageName: 'image' }} | ${true}
      ${{ subscriptionId: '', resourceGroupName: 'rg', galleryName: 'gallery', galleryImageName: 'image' }}    | ${false}
      ${{ subscriptionId: 'sub', resourceGroupName: 'rg', galleryName: 'gallery' }}                            | ${false}
      ${'not-json'}                                                                                            | ${false}
    `('safeParse($input) === $expected', ({ input, expected }) => {
      const serialized =
        typeof input === 'string' ? input : JSON.stringify(input);

      expect(AzureComputeGalleryPackage.safeParse(serialized).success).toBe(
        expected,
      );
    });
  });

  describe('AzureComputeGalleryVersions', () => {
    it('keeps usable version fields and drops malformed entries', () => {
      expect(
        AzureComputeGalleryVersions.parse({
          value: [
            {
              name: '1.0.0',
              properties: {
                publishingProfile: {
                  publishedDate: '2024-01-02T03:04:05Z',
                  excludeFromLatest: false,
                },
              },
            },
            {
              name: '2.0.0',
              properties: {
                publishingProfile: {
                  excludeFromLatest: true,
                },
              },
            },
            {
              name: '3.0.0',
              properties: {
                publishingProfile: {
                  excludeFromLatest: false,
                },
              },
            },
            {
              name: '4.0.0',
              properties: {
                publishingProfile: {},
              },
            },
            {
              name: '5.0.0',
              properties: {
                publishingProfile: {
                  excludeFromLatest: null,
                },
              },
            },
            {
              name: '6.0.0',
              properties: {},
            },
            { properties: {} },
          ],
          nextLink:
            'https://management.azure.com/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Compute/galleries/gallery/images/image/versions?api-version=2025-03-03&$skiptoken=next',
        }),
      ).toEqual({
        value: [
          {
            version: '1.0.0',
            releaseTimestamp: '2024-01-02T03:04:05.000Z',
          },
          {
            version: '3.0.0',
          },
          {
            version: '4.0.0',
          },
          {
            version: '5.0.0',
          },
        ],
        nextLink:
          'https://management.azure.com/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Compute/galleries/gallery/images/image/versions?api-version=2025-03-03&$skiptoken=next',
      });
    });
  });
});
