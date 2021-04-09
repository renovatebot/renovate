import { readFileSync } from 'fs';
import { extractLockFileEntries } from './locked-version';

const gemLockFile = readFileSync(
  'lib/manager/bundler/__fixtures__/Gemfile.rails.lock',
  'utf8'
);
describe('extract lib/manager/bundler/gemfile.rails.lock', () => {
  it('matches the expected output', () => {
    expect(extractLockFileEntries(gemLockFile)).toMatchSnapshot();
  });
});
