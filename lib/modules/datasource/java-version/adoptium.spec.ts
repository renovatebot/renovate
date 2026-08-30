import { partial } from '~test/util.ts';
import type { Http } from '../../../util/http/index.ts';
import { getAdoptiumReleases } from './adoptium.ts';

describe('modules/datasource/java-version/adoptium', () => {
  it('re-throws non-HttpError', async () => {
    const mockHttp = partial<Http>({
      getJson: vi.fn().mockRejectedValue(new Error('unexpected')),
    });

    await expect(
      getAdoptiumReleases(mockHttp, {
        imageType: 'jdk',
        architecture: null,
        os: null,
      }),
    ).rejects.toThrow('unexpected');
  });
});
