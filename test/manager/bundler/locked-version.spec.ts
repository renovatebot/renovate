import { readFileSync } from 'fs';
import { extractLockFileEntries } from '../../../lib/manager/bundler/locked-version';
import { isValid } from '../../../lib/versioning/ruby/index';

const railsGemfileLock = readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.rails.lock',
  'utf8'
);
const webPackerGemfileLock = readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.webpacker.lock',
  'utf8'
);
const mastodonGemfileLock = readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.mastodon.lock',
  'utf8'
);
describe('/lib/manager/bundler/locked-version', () => {
  test('Parse Rails Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(railsGemfileLock);
    expect(parsedLockEntries).toMatchSnapshot();
    expect(
      parsedLockEntries.deps.every(dep => {
        return dep.lockedVersion && isValid(dep.lockedVersion);
      })
    ).toBe(true);
  });
  test('Parse WebPacker Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(webPackerGemfileLock);
    expect(parsedLockEntries).toMatchSnapshot();
    expect(
      parsedLockEntries.deps.every(dep => {
        return dep.lockedVersion && isValid(dep.lockedVersion);
      })
    ).toBe(true);
  });
  test('Parse Mastodon Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(mastodonGemfileLock);
    expect(
      parsedLockEntries.deps.every(dep => {
        return dep.lockedVersion && isValid(dep.lockedVersion);
      })
    ).toBe(true);
    expect(parsedLockEntries).toMatchSnapshot();
  });
});
