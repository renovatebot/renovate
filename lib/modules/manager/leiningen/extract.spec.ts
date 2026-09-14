import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import { ClojureDatasource } from '../../datasource/clojure/index.ts';
import { extractFromVectors, extractVariables, trimAtKey } from './extract.ts';
import { extractPackageFile } from './index.ts';

const leinProjectClj = Fixtures.get(`project.clj`);

describe('modules/manager/leiningen/extract', () => {
  it('trimAtKey', () => {
    expect(trimAtKey('foo', 'bar')).toBeNull();
    expect(trimAtKey(':dependencies    ', 'dependencies')).toBeNull();
    expect(trimAtKey(':dependencies \nfoobar', 'dependencies')).toBe('foobar');
    expect(
      trimAtKey(
        ':parent-project {:coords [my-org/my-parent "4.3.0"]\n:inherit [:profiles]}',
        'coords',
      ),
    ).toBe('[my-org/my-parent "4.3.0"]\n:inherit [:profiles]}');
  });

  it('extractFromVectors', () => {
    expect(extractFromVectors('')).toBeEmptyArray();
    expect(extractFromVectors('[]')).toBeEmptyArray();
    expect(extractFromVectors('[[]]')).toBeEmptyArray();
    expect(extractFromVectors('[#_[foo/bar "1.2.3"]]')).toBeEmptyArray();
    expect(extractFromVectors('[[foo/bar "1.2.3"]]')).toEqual([
      {
        datasource: ClojureDatasource.id,
        depName: 'foo:bar',
        currentValue: '1.2.3',
      },
    ]);
    expect(
      extractFromVectors('[[foo/bar ~baz]]', {}, { baz: '1.2.3' }),
    ).toEqual([
      {
        datasource: ClojureDatasource.id,
        depName: 'foo:bar',
        currentValue: '1.2.3',
        sharedVariableName: 'baz',
      },
    ]);
    expect(
      extractFromVectors('[\t[foo/bar "1.2.3"]\n["foo/baz"  "4.5.6"] ]'),
    ).toEqual([
      {
        datasource: ClojureDatasource.id,
        depName: 'foo:bar',
        currentValue: '1.2.3',
      },
      {
        datasource: ClojureDatasource.id,
        depName: 'foo:baz',
        currentValue: '4.5.6',
      },
    ]);
    expect(
      extractFromVectors(
        '[my-org/my-parent "4.3.0"]\n:inherit [:profiles]}',
        {},
        {},
        1,
      ),
    ).toEqual([
      {
        datasource: ClojureDatasource.id,
        depName: 'my-org:my-parent',
        currentValue: '4.3.0',
      },
    ]);
  });

  it('extractPackageFile', () => {
    expect(extractPackageFile(leinProjectClj)).toMatchObject({
      deps: [
        {
          currentValue: '1.3.0',
          depName: 'org.clojure:clojure',
          depType: 'dependencies',
          registryUrls: [
            'https://download.java.net/maven/2',
            'https://oss.sonatype.org/content/repositories/releases',
            'https://blueant.com/archiva/snapshots',
            'https://blueant.com/archiva/internal',
          ],
        },
        {
          currentValue: '1.0',
          depName: 'org.jclouds:jclouds',
          depType: 'dependencies',
        },
        {
          currentValue: '2.3.1',
          depName: 'net.sf.ehcache:ehcache',
          depType: 'dependencies',
        },
        {
          currentValue: '1.2.15',
          depName: 'log4j:log4j',
          depType: 'dependencies',
        },
        {
          currentValue: '3.0.2',
          depName: 'net.3scale:3scale-api',
          depType: 'dependencies',
        },
        {
          currentValue: '2.8.5',
          depName: 'org.lwjgl.lwjgl:lwjgl',
          depType: 'dependencies',
        },
        {
          currentValue: '2.8.5',
          depName: 'org.lwjgl.lwjgl:lwjgl-platform',
          depType: 'dependencies',
        },
        {
          currentValue: '1.4.0',
          depName: 'org.clojure:clojure',
          depType: 'dependencies',
        },
        {
          currentValue: '1.5.0',
          depName: 'org.clojure:clojure',
          depType: 'dependencies',
        },
        {
          currentValue: '0.2.4',
          depName: 'clj-stacktrace:clj-stacktrace',
          depType: 'dependencies',
          sharedVariableName: 'clj-stacktrace-version',
        },
        {
          currentValue: '0.12.0',
          depName: 'clj-time:clj-time',
          depType: 'managed-dependencies',
        },
        {
          currentValue: '1.4.6',
          depName: 'me.raynes:fs',
          depType: 'managed-dependencies',
        },
        {
          currentValue: '1.1.1',
          depName: 'lein-pprint:lein-pprint',
          depType: 'plugins',
        },
        {
          currentValue: '0.1.0',
          depName: 'lein-assoc:lein-assoc',
          depType: 'plugins',
        },
        {
          currentValue: '1.1.1',
          depName: 's3-wagon-private:s3-wagon-private',
          depType: 'plugins',
        },
        {
          currentValue: '0.0.1',
          depName: 'lein-foo:lein-foo',
          depType: 'plugins',
        },
        {
          currentValue: '0.0.1',
          depName: 'lein-bar:lein-bar',
          depType: 'plugins',
        },
        {
          currentValue: '0.7.1',
          depName: 'cider:cider-nrepl',
          depType: 'plugins',
        },
        {
          currentValue: '1.3.13',
          depName: 'com.theoryinpractise:clojure-maven-plugin',
          depType: 'pom-plugins',
        },
        {
          currentValue: '2.1',
          depName: 'org.apache.tomcat.maven:tomcat7-maven-plugin',
          depType: 'pom-plugins',
        },
        {
          currentValue: '1.9.68',
          depName: 'com.google.appengine:appengine-maven-plugin',
          depType: 'pom-plugins',
        },
      ],
    });

    const parentProjectSrc = codeBlock`
(defproject org.example/parent-project "1.0.0-SNAPSHOT"
  :plugins [[lein-parent "0.3.9"]
            [lein-project-version "0.1.0"]
            [lein-shell "0.5.0"]]
  :parent-project {:coords [my-org/my-parent "4.3.0"]
                   :inherit [:profiles :managed-dependencies :local-repo]}
  :profiles {:cljfmt {:plugins [[lein-cljfmt "0.9.2"]]}}
  :dependencies [[org.clojure/core.async "1.6.681"]
                 [org.clojure/core.match "1.1.0"]
                 [org.clojure/data.csv "1.1.0"]
                 [org.clojure/tools.cli "1.1.230"]
                 [metosin/malli "0.15.0"]])`;

    expect(extractPackageFile(parentProjectSrc)).toMatchObject({
      deps: [
        {
          depName: 'org.clojure:core.async',
          datasource: 'clojure',
          depType: 'dependencies',
          registryUrls: [],
          currentValue: '1.6.681',
        },
        {
          depName: 'org.clojure:core.match',
          datasource: 'clojure',
          depType: 'dependencies',
          registryUrls: [],
          currentValue: '1.1.0',
        },
        {
          depName: 'org.clojure:data.csv',
          datasource: 'clojure',
          depType: 'dependencies',
          registryUrls: [],
          currentValue: '1.1.0',
        },
        {
          depName: 'org.clojure:tools.cli',
          datasource: 'clojure',
          depType: 'dependencies',
          registryUrls: [],
          currentValue: '1.1.230',
        },
        {
          depName: 'metosin:malli',
          datasource: 'clojure',
          depType: 'dependencies',
          registryUrls: [],
          currentValue: '0.15.0',
        },
        {
          depName: 'lein-parent:lein-parent',
          datasource: 'clojure',
          depType: 'plugins',
          registryUrls: [],
          currentValue: '0.3.9',
        },
        {
          depName: 'lein-project-version:lein-project-version',
          datasource: 'clojure',
          depType: 'plugins',
          registryUrls: [],
          currentValue: '0.1.0',
        },
        {
          depName: 'lein-shell:lein-shell',
          datasource: 'clojure',
          depType: 'plugins',
          registryUrls: [],
          currentValue: '0.5.0',
        },
        {
          depName: 'lein-cljfmt:lein-cljfmt',
          datasource: 'clojure',
          depType: 'plugins',
          registryUrls: [],
          currentValue: '0.9.2',
        },
        {
          depName: 'my-org:my-parent',
          datasource: 'clojure',
          depType: 'parent-project',
          registryUrls: [],
          currentValue: '4.3.0',
        },
      ],
    });
  });

  it('extractVariables', () => {
    expect(extractVariables('(def foo "1")')).toEqual({ foo: '1' });
    expect(extractVariables('(def foo"2")')).toEqual({ foo: '2' });
    expect(extractVariables('(def foo "3")\n(def bar "4")')).toEqual({
      foo: '3',
      bar: '4',
    });
  });
});
