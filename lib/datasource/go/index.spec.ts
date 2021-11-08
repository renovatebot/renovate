import { mocked } from '../../../test/util';
import * as _hostRules from '../../util/host-rules';
import * as _direct from './releases-direct';
import * as _goproxy from './releases-goproxy';
import { getReleases } from '.';

jest.mock('../../util/host-rules');
const hostRules = mocked(_hostRules);

jest.mock('./releases-direct');
const direct = mocked(_direct);

jest.mock('./releases-goproxy');
const goproxy = mocked(_goproxy);

describe('datasource/go/index', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      hostRules.find.mockReturnValue({});
      hostRules.hosts.mockReturnValue([]);
    });

    afterEach(() => {
      jest.resetAllMocks();
      delete process.env.GOPROXY;
    });

    it('fetches release info directly from VCS', async () => {
      const expected = { releases: [{ version: '0.0.1' }] };
      goproxy.getReleases.mockResolvedValue(null);
      direct.getReleases.mockResolvedValue(expected);

      const res = await getReleases({ lookupName: 'golang.org/foo/bar' });

      expect(res).toBe(expected);
      expect(goproxy.getReleases).not.toHaveBeenCalled();
      expect(direct.getReleases).toHaveBeenCalled();
    });

    it('supports GOPROXY', async () => {
      const expected = { releases: [{ version: '0.0.1' }] };
      goproxy.getReleases.mockResolvedValue(expected);
      direct.getReleases.mockResolvedValue(null);
      process.env.GOPROXY = 'https://proxy.golang.org,direct';

      const res = await getReleases({ lookupName: 'golang.org/foo/bar' });

      expect(res).toBe(expected);
      expect(goproxy.getReleases).toHaveBeenCalled();
      expect(direct.getReleases).not.toHaveBeenCalled();
    });
  });
});
