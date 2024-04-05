import { stripIndent } from 'common-tags';
import {
  parseLockFile,
  parsePropsFile,
  usesGcv,
} from './consistent-versions-plugin';

describe('modules/manager/gradle/extract/consistent-versions-plugin', () => {
  it('gradle-consistent-versions plugin works for sub folders', () => {
    const fsMock = {
      'mysub/build.gradle.kts': `(this file contains) 'com.palantir.consistent-versions'`,
      'mysub/versions.props': `org.apache.lucene:* = 1.2.3`,
      'mysub/versions.lock': stripIndent`
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
      'versions.lock': stripIndent`
        # Run ./gradlew writeVersionsLock to regenerate this file
        org.apache.lucene:lucene-core:1.2.3`,
    };

    expect(usesGcv('versions.props', fsMock)).toBeTrue();
  });

  it('gradle-consistent-versions plugin correct position for CRLF and LF', () => {
    const crlfProps = parsePropsFile(`a.b:c.d=1\r\na.b:c.e=2`);
    expect(crlfProps).toBeArrayOfSize(2);
    expect(crlfProps[0].has('a.b:c.e')).toBeTrue();
    expect(crlfProps[0].get('a.b:c.e')).toMatchObject({ filePos: 19 });

    const lfProps = parsePropsFile(`a.b:c.d=1\na.b:c.e=2`);
    expect(lfProps).toBeArrayOfSize(2);
    expect(lfProps[0].has('a.b:c.e')).toBeTrue();
    expect(lfProps[0].get('a.b:c.e')).toMatchObject({ filePos: 18 });
  });

  it('gradle-consistent-versions plugin test bogus input lines', () => {
    const parsedProps = parsePropsFile(stripIndent`
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

    const parsedLock = parseLockFile(stripIndent`
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
});
