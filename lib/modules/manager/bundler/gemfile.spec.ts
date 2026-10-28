import { Fixtures } from '~test/fixtures.ts';
import { extractLockFileEntries } from './locked-version.ts';

const gemLockFile = Fixtures.get('Gemfile.rails.lock');

describe('modules/manager/bundler/gemfile', () => {
  it('matches the expected output', () => {
    const res = extractLockFileEntries(gemLockFile);
    expect(Object.fromEntries(res)).toEqual({
      'activerecord-jdbc-adapter': '52.1',
      'activerecord-jdbcsqlite3-adapter': '52.1',
      'azure-core': '0.1.14',
      'azure-storage': '0.15.0.preview',
      listen: '3.1.5',
      nokogiri: '1.9.1',
      pg: '1.1.3',
      rake: '12.3.1',
      redcarpet: '3.2.3',
    });
  });
});
