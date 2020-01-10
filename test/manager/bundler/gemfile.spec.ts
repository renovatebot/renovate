import { readFileSync } from 'fs';
import { extractLockFileEntries } from '../../../lib/manager/bundler/locked-version';

const gemLockFile = readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.rails.lock',
  'utf8'
);
describe('extract lib/manager/bundler/gemfile.rails.lock', () => {
  it('matches the expected output', () => {
    expect(extractLockFileEntries(gemLockFile)).toMatchSnapshot();
  });
});
