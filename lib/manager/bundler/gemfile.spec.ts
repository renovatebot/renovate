import { loadFixture } from '../../../test/util';
import { extractLockFileEntries } from './locked-version';

const gemLockFile = loadFixture(__filename, 'Gemfile.rails.lock');

describe('extract lib/manager/bundler/gemfile.rails.lock', () => {
  it('matches the expected output', () => {
    expect(extractLockFileEntries(gemLockFile)).toMatchSnapshot();
  });
});
