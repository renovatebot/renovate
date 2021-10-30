import { mocked } from '../../../test/util';
import * as _hostRules from '../../util/host-rules';
import * as _goproxy from './goproxy';
import * as _direct from './releases-direct';
import { getReleases } from '.';

jest.mock('../../util/host-rules');
const hostRules = mocked(_hostRules);

jest.mock('./goproxy');
const goproxy = mocked(_goproxy);

jest.mock('./releases-direct');
const direct = mocked(_direct);

describe('datasource/go/index', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      hostRules.find.mockReturnValue({});
      hostRules.hosts.mockReturnValue([]);
      process.env.GOPROXY = 'https://proxy.golang.org,direct';
    });

    afterEach(() => {
      jest.resetAllMocks();
      delete process.env.GOPROXY;
    });

    it('fetches release info directly from VCS', async () => {
      const expected = { releases: [{ version: '0.0.1' }] };
      goproxy.getReleases.mockResolvedValue(null);
      direct.getReleases.mockResolvedValue(expected);

      const res = await getReleases({ lookupName: 'golang.org/foo/something' });

      expect(res).toBe(expected);
      expect(goproxy.getReleases).toHaveBeenCalled();
      expect(direct.getReleases).toHaveBeenCalled();
    });

    it('supports GOPROXY', async () => {
      const expected = { releases: [{ version: '0.0.1' }] };
      goproxy.getReleases.mockResolvedValue(expected);
      direct.getReleases.mockResolvedValue(null);

      const res = await getReleases({ lookupName: 'golang.org/foo/something' });

      expect(res).toBe(expected);
      expect(goproxy.getReleases).toHaveBeenCalled();
      expect(direct.getReleases).not.toHaveBeenCalled();
    });
  });
});
