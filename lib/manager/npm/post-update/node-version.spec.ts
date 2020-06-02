import { mocked } from '../../../../test/util';
import * as fs_ from '../../../util/fs';
import { getNodeConstraint } from './node-version';

const fs = mocked(fs_);

describe('getNodeConstraint', () => {
  it('returns package.json range', async () => {
    fs.readLocalFile = jest.fn();
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce('{"engines":{"node":"^12.16.0"}}');
    const res = await getNodeConstraint('package.json');
    expect(res).toEqual('^12.16.0');
  });
  it('returns .node-version value', async () => {
    fs.readLocalFile = jest.fn();
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce('12.16.1\n');
    const res = await getNodeConstraint('package.json');
    expect(res).toEqual('12.16.1');
  });
  it('returns .nvmrc value', async () => {
    fs.readLocalFile = jest.fn();
    fs.readLocalFile.mockResolvedValueOnce('12.16.2\n');
    const res = await getNodeConstraint('package.json');
    expect(res).toEqual('12.16.2');
  });
  it('ignores unusable ranges in dotfiles', async () => {
    fs.readLocalFile = jest.fn();
    fs.readLocalFile.mockResolvedValueOnce('latest');
    fs.readLocalFile.mockResolvedValueOnce('lts');
    fs.readLocalFile.mockResolvedValueOnce('{"engines":{"node":"^12.16.0"}}');
    const res = await getNodeConstraint('package.json');
    expect(res).toEqual('^12.16.0');
  });
  it('returns no constraint', async () => {
    fs.readLocalFile = jest.fn();
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const res = await getNodeConstraint('package.json');
    expect(res).toBeNull();
  });
});
