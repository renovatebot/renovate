import { codeBlock } from 'common-tags';
import {
  parseGcv,
  parseLockFile,
  parsePropsFile,
  usesGcv,
} from './consistent-versions-plugin';

describe('modules/manager/gradle/extract/consistent-versions-plugin', () => {
  it('works for sub folders', () => {
    const fsMock = {
      'mysub/build.gradle.kts': `(this file contains) 'com.palantir.consistent-versions'`,
      'mysub/versions.props': `org.apache.lucene:* = 1.2.3`,
      'mysub/versions.lock': codeBlock`
        # Run ./gradlew --write-locks to regenerate this file
        org.apache.lucene:lucene-core:1.2.3`,
      'othersub/build.gradle.kts': `nothing here`,
    };

    expect(usesGcv('mysub/versions.props', fsMock)).toBeTrue();
    expect(usesGcv('othersub/versions.props', fsMock)).toBeFalse();
  });

  it('detects lock file header introduced with gradle-consistent-versions version 2.20.0', () => {
    const fsMock = {
      'build.gradle.kts': `(this file contains) 'com.palantir.consistent-versions'`,
      'versions.props': `org.apache.lucene:* = 1.2.3`,
      'versions.lock': codeBlock`
        # Run ./gradlew writeVersionsLock to regenerate this file
        org.apache.lucene:lucene-core:1.2.3`,
    };

    expect(usesGcv('versions.props', fsMock)).toBeTrue();
  });

  it('detects lock file header introduced with gradle-consistent-versions version 2.23.0', () => {
    const fsMock = {
      'build.gradle.kts': `(this file contains) 'com.palantir.consistent-versions'`,
      'versions.props': `org.apache.lucene:* = 1.2.3`,
      'versions.lock': codeBlock`
        # Run ./gradlew writeVersionsLocks to regenerate this file
        org.apache.lucene:lucene-core:1.2.3`,
    };

    expect(usesGcv('versions.props', fsMock)).toBeTrue();
  });

  it('correct position for CRLF and LF', () => {
    const crlfProps = parsePropsFile(`a.b:c.d=1\r\na.b:c.e=2`);
    expect(crlfProps).toBeArrayOfSize(2);
    expect(crlfProps[0].has('a.b:c.e')).toBeTrue();
    expect(crlfProps[0].get('a.b:c.e')).toMatchObject({ filePos: 19 });

    const lfProps = parsePropsFile(`a.b:c.d=1\na.b:c.e=2`);
    expect(lfProps).toBeArrayOfSize(2);
    expect(lfProps[0].has('a.b:c.e')).toBeTrue();
    expect(lfProps[0].get('a.b:c.e')).toMatchObject({ filePos: 18 });
  });

  it('test bogus input lines', () => {
    const parsedProps = parsePropsFile(codeBlock`
      # comment:foo.bar = 1
      123.foo:bar = 2
      this has:spaces = 3
       starts.with:space = 4
      contains(special):chars = 5
      a* = 6
      this.is:valid.dep = 7
      valid.glob:* = 8
    `);

    expect(parsedProps[0]).toMatchObject({ size: 1 }); // no 7 is valid exact dep
    expect(parsedProps[1]).toMatchObject({ size: 1 }); // no 8 is valid glob dep

    const parsedLock = parseLockFile(codeBlock`
      # comment:foo.bar:1 (10 constraints: 95be0c15)
      123.foo:bar:2 (10 constraints: 95be0c15)
      this has:spaces:3 (10 constraints: 95be0c15)
       starts.with:space:4 (10 constraints: 95be0c15)
      contains(special):chars:5 (10 constraints: 95be0c15)
      no.colon:6 (10 constraints: 95be0c15)
      this.is:valid.dep:7 (10 constraints: 95be0c15)

      [Test dependencies]
      this.is:valid.test.dep:8 (10 constraints: 95be0c15)
    `);

    expect(parsedLock.size).toBe(2);
    expect(parsedLock.get('this.is:valid.dep')).toMatchObject({
      depType: 'dependencies',
    });
    expect(parsedLock.get('this.is:valid.test.dep')).toMatchObject({
      depType: 'test',
    });
  });

  it('supports multiple levels of glob', () => {
    const fsMock = {
      'versions.props': codeBlock`
          org.apache.* = 4
          org.apache.lucene:* = 3
          org.apache.lucene:a.* = 2
          org.apache.lucene:a.b = 1
          org.apache.foo*:* = 5
        `,
      'versions.lock': codeBlock`
          # Run ./gradlew --write-locks to regenerate this file
          org.apache.solr:x.y:1 (10 constraints: 95be0c15)
          org.apache.lucene:a.b:1 (10 constraints: 95be0c15)
          org.apache.lucene:a.c:1 (10 constraints: 95be0c15)
          org.apache.lucene:a.d:1 (10 constraints: 95be0c15)
          org.apache.lucene:d:1 (10 constraints: 95be0c15)
          org.apache.lucene:e.f:1 (10 constraints: 95be0c15)
          org.apache.foo-bar:a:1 (10 constraints: 95be0c15)
        `,
    };
    const res = parseGcv('versions.props', fsMock);

    // Each lock dep is only present once, with highest prio for exact prop match, then globs from longest to shortest
    expect(res).toStrictEqual([
      {
        managerData: {
          packageFile: 'versions.props',
          fileReplacePosition: 91,
        },
        depName: 'org.apache.lucene:a.b',
        currentValue: '1',
        lockedVersion: '1',
        depType: 'dependencies',
      },
      {
        managerData: {
          packageFile: 'versions.props',
          fileReplacePosition: 65,
        },
        depName: 'org.apache.lucene:a.c',
        currentValue: '2',
        lockedVersion: '1',
        sharedVariableName: 'org.apache.lucene:a.*',
        depType: 'dependencies',
      },
      {
        managerData: {
          packageFile: 'versions.props',
          fileReplacePosition: 65,
        },
        depName: 'org.apache.lucene:a.d',
        currentValue: '2',
        lockedVersion: '1',
        sharedVariableName: 'org.apache.lucene:a.*',
        depType: 'dependencies',
      },
      {
        managerData: {
          packageFile: 'versions.props',
          fileReplacePosition: 39,
        },
        depName: 'org.apache.lucene:d',
        currentValue: '3',
        lockedVersion: '1',
        sharedVariableName: 'org.apache.lucene:*',
        depType: 'dependencies',
      },
      {
        managerData: {
          packageFile: 'versions.props',
          fileReplacePosition: 39,
        },
        depName: 'org.apache.lucene:e.f',
        currentValue: '3',
        lockedVersion: '1',
        sharedVariableName: 'org.apache.lucene:*',
        depType: 'dependencies',
      },
      {
        managerData: {
          fileReplacePosition: 113,
          packageFile: 'versions.props',
        },
        depName: 'org.apache.foo-bar:a',
        currentValue: '5',
        lockedVersion: '1',
        sharedVariableName: 'org.apache.foo*:*',
        depType: 'dependencies',
      },
    ]);
  });
});
