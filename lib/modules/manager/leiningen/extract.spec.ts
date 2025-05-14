import { codeBlock } from 'common-tags';
import { ClojureDatasource } from '../../datasource/clojure';
import { extractFromVectors, extractVariables, trimAtKey } from './extract';
import { extractPackageFile } from '.';
import { Fixtures } from '~test/fixtures';

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
    expect(extractPackageFile(leinProjectClj)).toMatchSnapshot({
      deps: [
        { depName: 'org.clojure:clojure', currentValue: '1.3.0' },
        { depName: 'org.jclouds:jclouds', currentValue: '1.0' },
        { depName: 'net.sf.ehcache:ehcache', currentValue: '2.3.1' },
        { depName: 'log4j:log4j', currentValue: '1.2.15' },
        { depName: 'net.3scale:3scale-api', currentValue: '3.0.2' },
        { depName: 'org.lwjgl.lwjgl:lwjgl', currentValue: '2.8.5' },
        { depName: 'org.lwjgl.lwjgl:lwjgl-platform', currentValue: '2.8.5' },
        { depName: 'org.clojure:clojure', currentValue: '1.4.0' },
        { depName: 'org.clojure:clojure', currentValue: '1.5.0' },
        {
          depName: 'clj-stacktrace:clj-stacktrace',
          currentValue: '0.2.4',
          sharedVariableName: 'clj-stacktrace-version',
        },
        {
          depName: 'clj-time:clj-time',
          currentValue: '0.12.0',
          depType: 'managed-dependencies',
        },
        {
          depName: 'me.raynes:fs',
          currentValue: '1.4.6',
          depType: 'managed-dependencies',
        },
        {
          depName: 'lein-pprint:lein-pprint',
          currentValue: '1.1.1',
          depType: 'plugins',
        },
        {
          depName: 'lein-assoc:lein-assoc',
          currentValue: '0.1.0',
          depType: 'plugins',
        },
        {
          depName: 's3-wagon-private:s3-wagon-private',
          currentValue: '1.1.1',
          depType: 'plugins',
        },
        {
          depName: 'lein-foo:lein-foo',
          currentValue: '0.0.1',
          depType: 'plugins',
        },
        {
          depName: 'lein-bar:lein-bar',
          currentValue: '0.0.1',
          depType: 'plugins',
        },
        {
          depName: 'cider:cider-nrepl',
          currentValue: '0.7.1',
          depType: 'plugins',
        },
        {
          depName: 'com.theoryinpractise:clojure-maven-plugin',
          currentValue: '1.3.13',
          depType: 'pom-plugins',
        },
        {
          depName: 'org.apache.tomcat.maven:tomcat7-maven-plugin',
          currentValue: '2.1',
          depType: 'pom-plugins',
        },
        {
          depName: 'com.google.appengine:appengine-maven-plugin',
          currentValue: '1.9.68',
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
