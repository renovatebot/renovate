import { Fixtures } from '~test/fixtures.ts';
import { extractLockFileEntries } from './locked-version.ts';

const gemLockFile = Fixtures.get('Gemfile.rails.lock');

describe('modules/manager/bundler/gemfile', () => {
  it('matches the expected output', () => {
    const res = extractLockFileEntries(gemLockFile);
    const lockEntries = Object.fromEntries(res);
    expect(Object.keys(lockEntries)).toHaveLength(185);
    // first entry, its `-java` platform suffix stripped; `bcrypt` is listed
    // once per platform and is kept only once
    expect(lockEntries).toMatchObject({
      'activerecord-jdbc-adapter': '52.1',
      bcrypt: '3.1.12',
      'azure-storage': '0.15.0.preview',
      'http_parser.rb': '0.6.0',
      'mime-types-data': '3.2018.0812',
      parser: '2.5.3.0',
      xpath: '3.2.0',
    });
  });
});
