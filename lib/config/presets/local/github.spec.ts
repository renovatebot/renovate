import { mocked } from '../../../../test/util';
import { GotResponse } from '../../../platform';
import { clearRepoCache } from '../../../util/cache';
import _got from '../../../util/got';
import * as _hostRules from '../../../util/host-rules';
import * as github from './github';
import { PartialDeep } from 'type-fest';

jest.mock('../../../util/got');
jest.mock('../../../util/host-rules');

const got: jest.Mock<PartialDeep<GotResponse>> = _got as never;
const hostRules = mocked(_hostRules);

describe('config/presets/github', () => {
  beforeEach(() => {
    got.mockReset();
    return global.renovateCache.rmAll();
  });
  describe('fetchJSONFile()', () => {
    beforeEach(() => {
      clearRepoCache();
    });
    it('returns JSON', async () => {
      hostRules.find.mockReturnValueOnce({ token: 'abc' });
      got.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('{"from":"api"}').toString('base64'),
        },
      }));
      const res = await github.fetchJSONFile(
        'some/repo',
        'some-filename',
        'https://api.github.com'
      );
      expect(res).toMatchSnapshot();
    });
  });

  describe('getPresetFromEndpoint()', () => {
    it('uses custom endpoint', async () => {
      await github
        .getPresetFromEndpoint(
          'some/repo',
          'default',
          'https://api.github.example.org'
        )
        .catch((_) => {});
      expect(got.mock.calls[0][0]).toEqual(
        'https://api.github.example.org/repos/some/repo/contents/default.json'
      );
    });
  });
});
