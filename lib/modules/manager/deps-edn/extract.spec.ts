import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from './extract';

describe('modules/manager/deps-edn/extract', () => {
  it('extractPackageFile', () => {
    const { deps } = extractPackageFile(Fixtures.get('deps.edn'));
    expect(deps).toMatchSnapshot([
      {
        depName: 'persistent-sorted-set:persistent-sorted-set',
        currentValue: '0.1.2',
      },
      {
        depName: 'org.clojure:clojure',
        currentValue: '1.9.0',
      },
      {
        depName: 'org.clojure:clojure',
        currentValue: '1.10.0',
      },
      {
        depName: 'org.clojure:clojurescript',
        currentValue: '1.10.520',
      },
      {
        depName: 'org.clojure:tools.namespace',
        currentValue: '0.2.11',
      },
      {
        depName: 'org.clojure:clojurescript',
        currentValue: '1.10.520',
      },
      {
        depName: 'lambdaisland:kaocha',
        currentValue: '0.0-389',
      },
      {
        depName: 'lambdaisland:kaocha-cljs',
        currentValue: '0.0-21',
      },
      {
        depName: 'cider:cider-nrepl',
        currentValue: '0.21.1',
      },
      {
        depName: 'nrepl:nrepl',
        currentValue: '0.6.0',
      },
      {
        depName: 'org.clojure:tools.namespace',
        currentValue: '0.2.11',
      },
      {
        depName: 'com.datomic:datomic-free',
        currentValue: '0.9.5703',
      },
    ]);
  });
});
