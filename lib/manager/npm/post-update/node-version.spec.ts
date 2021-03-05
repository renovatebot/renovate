import { fs } from '../../../../test/util';
import { isStable } from '../../../versioning/node';
import { getNodeConstraint } from './node-version';

jest.mock('../../../util/fs');

describe('getNodeConstraint', () => {
  const config = {
    packageFile: 'package.json',
    constraints: { node: '^12.16.0' },
  };
  it('returns package.json range', async () => {
    fs.readLocalFile = jest.fn();
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce(null);
    const res = await getNodeConstraint(config);
    expect(res).toEqual('^12.16.0');
  });
  it('augments to avoid node 15', async () => {
    fs.readLocalFile = jest.fn();
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce(null);
    const res = await getNodeConstraint({
      ...config,
      constraints: { node: '>= 12.16.0' },
    });
    const isAugmentedRange = res === '>= 12.16.0 <15';
    const node16IsStable = isStable('16.100.0');
    expect(isAugmentedRange || node16IsStable).toBe(true);
  });
  it('forces node 15 if v2 lockfile detected and constraint allows', async () => {
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce('{"lockfileVersion":2}');
    const res = await getNodeConstraint({
      ...config,
      constraints: { node: '>= 12.16.0' },
    });
    const isAugmentedRange = res === '>=15';
    const node16IsStable = isStable('16.100.0');
    expect(isAugmentedRange || node16IsStable).toBe(true);
  });
  it('forces node 15 if v2 lockfile detected and no constraint', async () => {
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce('{"lockfileVersion":2}');
    const res = await getNodeConstraint(
      {
        ...config,
        constraints: {},
      },
      true
    );
    const isAugmentedRange = res === '>=15';
    const node16IsStable = isStable('16.100.0');
    expect(isAugmentedRange || node16IsStable).toBe(true);
  });
  it('returns .node-version value', async () => {
    fs.readLocalFile = jest.fn();
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce('12.16.1\n');
    const res = await getNodeConstraint(config);
    expect(res).toEqual('12.16.1');
  });
  it('returns .nvmrc value', async () => {
    fs.readLocalFile = jest.fn();
    fs.readLocalFile.mockResolvedValueOnce('12.16.2\n');
    const res = await getNodeConstraint(config);
    expect(res).toEqual('12.16.2');
  });
  it('ignores unusable ranges in dotfiles', async () => {
    fs.readLocalFile = jest.fn();
    fs.readLocalFile.mockResolvedValueOnce('latest');
    fs.readLocalFile.mockResolvedValueOnce('lts');
    const res = await getNodeConstraint(config);
    expect(res).toEqual('^12.16.0');
  });
  it('returns no constraint', async () => {
    fs.readLocalFile = jest.fn();
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce(null);
    const res = await getNodeConstraint({ ...config, constraints: null });
    expect(res).toBeNull();
  });
});
