import { fs } from '../../../../../test/util';
import { getNodeConstraint } from './node-version';

jest.mock('../../../../util/fs');

describe('modules/manager/npm/post-update/node-version', () => {
  const config = {
    packageFile: 'package.json',
    constraints: { node: '^12.16.0' },
  };

  it('returns package.json range', async () => {
    fs.readLocalFile = jest.fn();
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce(null);
    const res = await getNodeConstraint(config);
    expect(res).toBe('^12.16.0');
  });

  it('returns .node-version value', async () => {
    fs.readLocalFile = jest.fn();
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce('12.16.1\n');
    const res = await getNodeConstraint(config);
    expect(res).toBe('12.16.1');
  });

  it('returns .nvmrc value', async () => {
    fs.readLocalFile = jest.fn();
    fs.readLocalFile.mockResolvedValueOnce('12.16.2\n');
    const res = await getNodeConstraint(config);
    expect(res).toBe('12.16.2');
  });

  it('ignores unusable ranges in dotfiles', async () => {
    fs.readLocalFile = jest.fn();
    fs.readLocalFile.mockResolvedValueOnce('latest');
    fs.readLocalFile.mockResolvedValueOnce('lts');
    const res = await getNodeConstraint(config);
    expect(res).toBe('^12.16.0');
  });

  it('returns no constraint', async () => {
    fs.readLocalFile = jest.fn();
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce(null);
    const res = await getNodeConstraint({ ...config, constraints: null });
    expect(res).toBeNull();
  });
});
