import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

describe('modules/manager/deps-edn/extract', () => {
  describe('extractPackageFile', () => {
    it('returns null for invalid file', () => {
      expect(extractPackageFile('123')).toBeNull();
    });

    it('extractPackageFile', () => {
      const res = extractPackageFile(Fixtures.get('deps.edn'));
      const deps = res?.deps;
      expect(deps).toMatchObject([
        {
          depName: 'persistent-sorted-set',
          currentValue: '0.1.2',
          registryUrls: [
            'https://deps.com/foo/bar',
            'https://my.auth.com/repo',
            's3://my-bucket/maven/releases',
          ],
        },
        {
          depName: 'io.github.nextjournal/clerk',
          currentValue: '0.7.418',
          datasource: 'clojure',
        },
        { depName: 'org.clojure/clojure', currentValue: '1.9.0' },
        { depName: 'org.clojure/clojure', currentValue: '1.10.0' },
        { depName: 'org.clojure/clojurescript', currentValue: '1.10.520' },
        { depName: 'org.clojure/tools.namespace', currentValue: '0.2.11' },
        { depName: 'org.clojure/clojurescript', currentValue: '1.10.520' },
        {
          depName: 'lambdaisland/kaocha',
          packageName: 'lambdaisland/kaocha',
          currentValue: '0.0-389',
        },
        {
          depName: 'io.github.lambdaisland/kaocha-cljs',
          currentValue: '0.0-21',
        },
        {
          depName: 'lambdaisland/kaocha',
          currentValue: '0.0-389',
          depType: 'test-gitlab',
        },
        {
          depName: 'com.gitlab.lambdaisland/kaocha-cljs',
          currentValue: '0.0-21',
        },
        {
          depName: 'lambdaisland/kaocha',
          currentValue: '0.0-389',
          depType: 'test-bitbucket',
        },
        {
          depName: 'org.bitbucket.lambdaisland/kaocha-cljs',
          currentValue: '0.0-21',
        },
        { depName: 'foo/foo', currentDigest: '123', datasource: 'git-refs' },
        { depName: 'bar/bar', sourceUrl: 'https://example.com/bar' },
        { depName: 'cider/cider-nrepl', currentValue: '0.21.1' },
        { depName: 'nrepl/nrepl', currentValue: '0.6.0' },
        { depName: 'org.clojure/tools.namespace', currentValue: '0.2.11' },
        { depName: 'com.datomic/datomic-free', currentValue: '0.9.5703' },
      ]);
    });
  });
});
