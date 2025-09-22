import * as azureApi from '../../platform/azure/azure-got-wrapper';
import { AzureTagsDatasource } from '.';

vi.mock('../../platform/azure/azure-got-wrapper');

describe('modules/datasource/azure-tags/index', () => {
  let azureTags: AzureTagsDatasource;
  let mockGitApi: any;

  beforeEach(() => {
    vi.resetAllMocks();
    azureTags = new AzureTagsDatasource();
    mockGitApi = {
      getRefs: vi.fn(),
    };
    vi.mocked(azureApi.gitApi).mockResolvedValue(mockGitApi);
  });

  describe('getReleases', () => {
    it('returns tags from azure devops', async () => {
      mockGitApi.getRefs.mockResolvedValueOnce([
        { name: 'tag1' },
        { name: 'tag2' },
      ]);

      const result = await azureTags.getReleases({
        registryUrl: 'https://dev.azure.com/organization/',
        packageName: 'repo',
      });

      expect(azureApi.gitApi).toHaveBeenCalledTimes(1);
      expect(mockGitApi.getRefs).toHaveBeenCalledWith(
        'repo',
        undefined,
        'tags',
      );
      expect(result).toEqual({
        sourceUrl: 'https://dev.azure.com/organization/_git/repo',
        registryUrl: 'https://dev.azure.com/organization/',
        releases: [
          { version: 'tag1', gitRef: 'tag1', releaseTimestamp: null },
          { version: 'tag2', gitRef: 'tag2', releaseTimestamp: null },
        ],
      });
    });

    it('filters out undefined names', async () => {
      mockGitApi.getRefs.mockResolvedValueOnce([
        { name: 'tag1' },
        { name: undefined },
        { name: 'tag2' },
        { name: null },
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

    it('handles api errors', async () => {
      mockGitApi.getRefs.mockRejectedValueOnce(new Error('API error'));

      await expect(
        azureTags.getReleases({
          registryUrl: 'https://dev.azure.com/organization/',
          packageName: 'repo',
        }),
      ).rejects.toThrow('API error');
    });
  });

  describe('static methods', () => {
    it('getCacheKey returns the expected format', () => {
      const key = AzureTagsDatasource.getCacheKey(
        'registry-url',
        'repo-name',
        'tags',
      );
      expect(key).toBe('registry-url:repo-name:tags');
    });

    it('getSourceUrl returns the correct URL format', () => {
      const url = AzureTagsDatasource.getSourceUrl(
        'repo-name',
        'https://dev.azure.com/organization/',
      );
      expect(url).toBe('https://dev.azure.com/organization/_git/repo-name');
    });
  });
});
