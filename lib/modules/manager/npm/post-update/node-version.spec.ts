import { fs } from '../../../../../test/util';
import { Lazy } from '../../../../util/lazy';
import {
  getNodeConstraint,
  getNodeToolConstraint,
  getNodeUpdate,
} from './node-version';

jest.mock('../../../../util/fs');

describe('modules/manager/npm/post-update/node-version', () => {
  const config = {
    packageFile: 'package.json',
    constraints: { node: '^12.16.0' },
  };

  describe('getNodeConstraint()', () => {
    it('returns from user constraints', async () => {
      const res = await getNodeConstraint(
        config,
        [],
        '',
        new Lazy(() => Promise.resolve({})),
      );
      expect(res).toBe('^12.16.0');
      expect(fs.readLocalFile).not.toHaveBeenCalled();
    });

    it('returns .node-version value', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      fs.readLocalFile.mockResolvedValueOnce('12.16.1\n');
      const res = await getNodeConstraint(
        {},
        [],
        '',
        new Lazy(() => Promise.resolve({})),
      );
      expect(res).toBe('12.16.1');
    });

    it('returns .nvmrc value', async () => {
      fs.readLocalFile.mockResolvedValueOnce('12.16.2\n');
      const res = await getNodeConstraint(
        {},
        [],
        '',
        new Lazy(() => Promise.resolve({})),
      );
      expect(res).toBe('12.16.2');
    });

    it('ignores unusable ranges in dotfiles', async () => {
      fs.readLocalFile.mockResolvedValueOnce('latest');
      fs.readLocalFile.mockResolvedValueOnce('lts');
      const res = await getNodeConstraint(
        {},
        [],
        '',
        new Lazy(() => Promise.resolve({})),
      );
      expect(res).toBeNull();
    });

    it('returns from package.json', async () => {
      const res = await getNodeConstraint(
        {},
        [],
        '',
        new Lazy(() => Promise.resolve({ engines: { node: '^12.16.3' } })),
      );
      expect(res).toBe('^12.16.3');
    });
  });

  describe('getNodeUpdate()', () => {
    it('returns version', () => {
      expect(getNodeUpdate([{ depName: 'node', newValue: '16.15.0' }])).toBe(
        '16.15.0',
      );
    });

    it('returns undefined', () => {
      expect(getNodeUpdate([])).toBeUndefined();
    });
  });

  describe('getNodeToolConstraint()', () => {
    it('returns getNodeUpdate', async () => {
      expect(
        await getNodeToolConstraint(
          config,
          [{ depName: 'node', newValue: '16.15.0' }],
          '',
          new Lazy(() => Promise.resolve({})),
        ),
      ).toEqual({
        toolName: 'node',
        constraint: '16.15.0',
      });
    });

    it('returns getNodeConstraint', async () => {
      expect(
        await getNodeToolConstraint(
          config,
          [],
          '',
          new Lazy(() => Promise.resolve({})),
        ),
      ).toEqual({
        toolName: 'node',
        constraint: '^12.16.0',
      });
    });
  });
});
