import { gitfs } from '../../../../test/util';
import { getNodeConstraint } from './node-version';

jest.mock('../../../util/git/fs');

describe('getNodeConstraint', () => {
  const config = {
    packageFile: 'package.json',
    compatibility: { node: '^12.16.0' },
  };
  it('returns package.json range', async () => {
    gitfs.readLocalFile = jest.fn();
    gitfs.readLocalFile.mockResolvedValueOnce(null);
    gitfs.readLocalFile.mockResolvedValueOnce(null);
    const res = await getNodeConstraint(config);
    expect(res).toEqual('^12.16.0');
  });
  it('returns .node-version value', async () => {
    gitfs.readLocalFile = jest.fn();
    gitfs.readLocalFile.mockResolvedValueOnce(null);
    gitfs.readLocalFile.mockResolvedValueOnce('12.16.1\n');
    const res = await getNodeConstraint(config);
    expect(res).toEqual('12.16.1');
  });
  it('returns .nvmrc value', async () => {
    gitfs.readLocalFile = jest.fn();
    gitfs.readLocalFile.mockResolvedValueOnce('12.16.2\n');
    const res = await getNodeConstraint(config);
    expect(res).toEqual('12.16.2');
  });
  it('ignores unusable ranges in dotfiles', async () => {
    gitfs.readLocalFile = jest.fn();
    gitfs.readLocalFile.mockResolvedValueOnce('latest');
    gitfs.readLocalFile.mockResolvedValueOnce('lts');
    const res = await getNodeConstraint(config);
    expect(res).toEqual('^12.16.0');
  });
  it('returns no constraint', async () => {
    gitfs.readLocalFile = jest.fn();
    gitfs.readLocalFile.mockResolvedValueOnce(null);
    gitfs.readLocalFile.mockResolvedValueOnce(null);
    const res = await getNodeConstraint({ ...config, compatibility: null });
    expect(res).toBeNull();
  });
});
