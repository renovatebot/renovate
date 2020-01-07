import { readFileSync } from 'fs';
import { extractLockFileEntries } from '../../../lib/manager/bundler/locked-version';

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
const rubyCIGemfileLock = readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.rubyci.lock',
  'utf8'
);
const gitlabFossGemfileLock = readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.gitlab-foss.lock',
  'utf8'
);
describe('/lib/manager/bundler/locked-version', () => {
  test('Parse Rails Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(railsGemfileLock);
    expect(parsedLockEntries).toMatchSnapshot();
  });
  test('Parse WebPacker Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(webPackerGemfileLock);
    expect(parsedLockEntries).toMatchSnapshot();
  });
  test('Parse Mastodon Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(mastodonGemfileLock);
    expect(parsedLockEntries).toMatchSnapshot();
  });
  test('Parse Ruby CI Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(rubyCIGemfileLock);
    expect(parsedLockEntries).toMatchSnapshot();
  });
  test('Parse Gitlab Foss Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(gitlabFossGemfileLock);
    expect(parsedLockEntries).toMatchSnapshot();
  });
});
