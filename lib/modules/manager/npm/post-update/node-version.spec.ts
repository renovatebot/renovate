import { fs } from '../../../../../test/util';
import { getNodeConstraint, getNodeUpdate } from './node-version';

jest.mock('../../../../util/fs');

describe('modules/manager/npm/post-update/node-version', () => {
  const config = {
    packageFile: 'package.json',
    constraints: { node: '^12.16.0' },
  };

  describe('getNodeConstraint()', () => {
    it('returns package.json range', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null as never);
      fs.readLocalFile.mockResolvedValueOnce(null as never);
      const res = await getNodeConstraint(config);
      expect(res).toBe('^12.16.0');
    });

    it('returns .node-version value', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null as never);
      fs.readLocalFile.mockResolvedValueOnce('12.16.1\n');
      const res = await getNodeConstraint(config);
      expect(res).toBe('12.16.1');
    });

    it('returns .nvmrc value', async () => {
      fs.readLocalFile.mockResolvedValueOnce('12.16.2\n');
      const res = await getNodeConstraint(config);
      expect(res).toBe('12.16.2');
    });

    it('ignores unusable ranges in dotfiles', async () => {
      fs.readLocalFile.mockResolvedValueOnce('latest');
      fs.readLocalFile.mockResolvedValueOnce('lts');
      const res = await getNodeConstraint(config);
      expect(res).toBe('^12.16.0');
    });

    it('returns no constraint', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null as never);
      fs.readLocalFile.mockResolvedValueOnce(null as never);
      const res = await getNodeConstraint({ ...config, constraints: null });
      expect(res).toBeNull();
    });
  });

  describe('getNodeUpdate()', () => {
    it('returns version', () => {
      expect(getNodeUpdate([{ depName: 'node', newValue: '16.15.0' }])).toBe(
        '16.15.0'
      );
    });

    it('returns undefined', () => {
      expect(getNodeUpdate([])).toBeUndefined();
    });
  });
});
