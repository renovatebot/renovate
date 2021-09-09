import { loadFixture } from '../../../test/util';
import { extractLockFileEntries } from './locked-version';

const gemLockFile = loadFixture('Gemfile.rails.lock');

describe('manager/bundler/gemfile', () => {
  it('matches the expected output', () => {
    const res = extractLockFileEntries(gemLockFile);
    expect(res.size).toEqual(185);
    expect(res).toMatchSnapshot();
  });
});
