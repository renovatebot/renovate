import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as azureHelper from '../../platform/azure/azure-helper';
import { AzureTagsDatasource } from '.';

describe('modules/datasource/azure-tags/index', () => {
  let azureTags: AzureTagsDatasource;

  beforeEach(() => {
    vi.restoreAllMocks();
    azureTags = new AzureTagsDatasource();
  });

  describe('getReleases', () => {
    it('returns tags from azure devops', async () => {
      vi.spyOn(azureHelper, 'getTags').mockResolvedValue([
        { name: 'tag1' },
        { name: 'tag2' },
      ]);
      const result = await azureTags.getReleases({
        registryUrl: 'https://dev.azure.com/organization/',
        packageName: 'repo',
      });
      expect(result).toEqual({
        sourceUrl: 'https://dev.azure.com/organization/_git/repo',
        registryUrl: 'https://dev.azure.com/organization/',
        releases: [
          { version: 'tag1', gitRef: 'tag1', releaseTimestamp: null },
          { version: 'tag2', gitRef: 'tag2', releaseTimestamp: null },
        ],
      });
    });

    it('uses empty string fallback if name is undefined', async () => {
      vi.spyOn(azureHelper, 'getTags').mockResolvedValue([{ name: undefined }]);
      const result = await azureTags.getReleases({
        registryUrl: 'https://dev.azure.com/organization/',
        packageName: 'repo',
      });
      expect(result).toEqual({
        sourceUrl: 'https://dev.azure.com/organization/_git/repo',
        registryUrl: 'https://dev.azure.com/organization/',
        releases: [{ version: '', gitRef: '', releaseTimestamp: null }],
      });
    });
  });
});
