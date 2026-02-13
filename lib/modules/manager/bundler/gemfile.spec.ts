import { Fixtures } from '~test/fixtures.ts';
import { extractLockFileEntries } from './locked-version.ts';

const gemLockFile = Fixtures.get('Gemfile.rails.lock');

describe('modules/manager/bundler/gemfile', () => {
  it('matches the expected output', () => {
    const res = extractLockFileEntries(gemLockFile);
    expect(res.size).toBe(185);
    expect(res).toMatchSnapshot();
  });
});
