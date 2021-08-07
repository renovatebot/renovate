import { loadFixture } from '../../../test/util';
import { extractLockFileEntries } from './locked-version';

const gemLockFile = loadFixture('Gemfile.rails.lock');

describe('extract lib/manager/bundler/gemfile.rails.lock', () => {
  it('matches the expected output', () => {
    // FIXME: explicit assert condition
    expect(extractLockFileEntries(gemLockFile)).toMatchSnapshot();
  });
});
