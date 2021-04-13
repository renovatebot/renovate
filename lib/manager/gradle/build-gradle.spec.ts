import { getName } from '../../../test/util';
import {
  collectVersionVariables,
  init,
  updateGradleVersion,
} from './build-gradle';

describe(getName(__filename), () => {
  beforeEach(() => {
    init();
  });

  it('returns the same file if dependency is null', () => {
    const gradleFile = "runtime('mysql:mysql-connector-java:6.0.5')";
    const updatedGradleFile = updateGradleVersion(gradleFile, null, null);
    expect(updatedGradleFile).toEqual(gradleFile);
  });

  it('returns the same file if version is not found', () => {
    const gradleFile = "runtime('mysql:mysql-connector-java:6.0.5')";
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'org.codehaus.groovy', name: 'groovy', version: '2.4.9' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(gradleFile);
  });

  it('returns a file updated if the version is found', () => {
    const gradleFile = "runtime (  'mysql:mysql-connector-java:6.0.5'  )";
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      "runtime (  'mysql:mysql-connector-java:7.0.0'  )"
    );
  });

  it('should returns a file updated with keeping an extension if the version is found', () => {
    const gradleFile =
      "runtime (  'com.crashlytics.sdk.android:crashlytics:2.8.0@aar'  )";
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      {
        group: 'com.crashlytics.sdk.android',
        name: 'crashlytics',
        version: '2.8.0',
      },
      '2.10.1'
    );
    expect(updatedGradleFile).toEqual(
      "runtime (  'com.crashlytics.sdk.android:crashlytics:2.10.1@aar'  )"
    );
  });

  it('should returns a file updated with keeping a classifier and an extension if the version is found', () => {
    const gradleFile = "runtime (  'junit:junit:4.0:javadoc@jar'  )";
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'junit', name: 'junit', version: '4.0' },
      '5.0'
    );
    expect(updatedGradleFile).toEqual(
      "runtime (  'junit:junit:5.0:javadoc@jar'  )"
    );
  });

  it('returns an updated file if the version in single quotes defined as map is found', () => {
    const gradleFile = `compile group  : 'mysql'               ,
               name   : 'mysql-connector-java',
               version: '6.0.5'`;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `compile group  : 'mysql'               ,
               name   : 'mysql-connector-java',
               version: '7.0.0'`
    );
  });

  it('returns an updated file if the version in single quotes defined as map is found in a different order', () => {
    const gradleFile = `compile name : 'mysql-connector-java',
               group  : 'mysql',
               version: '6.0.5'`;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `compile name : 'mysql-connector-java',
               group  : 'mysql',
               version: '7.0.0'`
    );
  });

  it('returns an updated file if the version in double quotes defined as map is found', () => {
    const gradleFile = `compile group  : 'mysql'               ,
               name   : 'mysql-connector-java',
               version: "6.0.5"`;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `compile group  : 'mysql'               ,
               name   : 'mysql-connector-java',
               version: "7.0.0"`
    );
  });

  it('returns an updated file if the version in double quotes defined as map is found in a different order', () => {
    const gradleFile = `compile name   : 'mysql-connector-java',
               version: "6.0.5",
               group  : 'mysql'`;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `compile name   : 'mysql-connector-java',
               version: "7.0.0",
               group  : 'mysql'`
    );
  });

  it('returns an updated file if the version in triple single quotes defined as map is found', () => {
    const gradleFile = `compile group  : 'mysql'               ,
               name   : 'mysql-connector-java',
               version: '''6.0.5'''`;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `compile group  : 'mysql'               ,
               name   : 'mysql-connector-java',
               version: '''7.0.0'''`
    );
  });

  it('returns an updated file if the version in triple single quotes defined as map is found in a different order', () => {
    const gradleFile = `compile version: '''6.0.5''',
               group  : 'mysql',
               name   : 'mysql-connector-java'`;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `compile version: '''7.0.0''',
               group  : 'mysql',
               name   : 'mysql-connector-java'`
    );
  });

  it('returns an updated file if the version in triple double quotes defined as map is found', () => {
    const gradleFile = `compile group  : 'mysql'               ,
               name   : 'mysql-connector-java',
               version: """6.0.5"""`;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `compile group  : 'mysql'               ,
               name   : 'mysql-connector-java',
               version: """7.0.0"""`
    );
  });

  it('returns an updated file if the version in triple double quotes defined as map is found in a different order', () => {
    const gradleFile = `compile version: """6.0.5""",
               name   : 'mysql-connector-java',
               group  : 'mysql'`;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `compile version: """7.0.0""",
               name   : 'mysql-connector-java',
               group  : 'mysql'`
    );
  });

  it('returns a file updated if the version defined as a Kotlin named argument is found', () => {
    const gradleFile = `compile(group   = "mysql"               ,
               name    = "mysql-connector-java",
               version = "6.0.5")`;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `compile(group   = "mysql"               ,
               name    = "mysql-connector-java",
               version = "7.0.0")`
    );
  });

  it('returns a file updated if the version defined as a Kotlin named argument is found in a different order', () => {
    const gradleFile = `compile(group = "mysql",
               version = "6.0.5",
               name    = "mysql-connector-java")`;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `compile(group = "mysql",
               version = "7.0.0",
               name    = "mysql-connector-java")`
    );
  });

  it('should returns a file updated if the version defined in a variable as a string is found', () => {
    const gradleFile = `String mysqlVersion= "6.0.5"
    runtime (  "mysql:mysql-connector-java:$mysqlVersion"  )
    `;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(`String mysqlVersion= "7.0.0"
    runtime (  "mysql:mysql-connector-java:$mysqlVersion"  )
    `);
  });

  it('should returns a file updated if the version defined in a expression as a string is found', () => {
    const gradleFile = `String mysqlVersion = "6.0.5"
    runtime (  "mysql:mysql-connector-java:\${mysqlVersion}"  )
    `;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(`String mysqlVersion = "7.0.0"
    runtime (  "mysql:mysql-connector-java:\${mysqlVersion}"  )
    `);
  });

  it('should returns a file updated if the version defined in a variable as a map is found', () => {
    const gradleFile = `String mysqlVersion = "6.0.5"
               compile group  : 'mysql'               ,
               name           : 'mysql-connector-java',
               version        : mysqlVersion
               `;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `String mysqlVersion = "7.0.0"
               compile group  : 'mysql'               ,
               name           : 'mysql-connector-java',
               version        : mysqlVersion
               `
    );
  });

  it('should returns a file updated if the version defined in a variable as a map is found in a different order', () => {
    const gradleFile = `String mysqlVersion = "6.0.5"
               compile name   : 'mysql-connector-java',
               group          : 'mysql'               ,
               version        : mysqlVersion
               `;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `String mysqlVersion = "7.0.0"
               compile name   : 'mysql-connector-java',
               group          : 'mysql'               ,
               version        : mysqlVersion
               `
    );
  });

  it('returns an updated file if the version defined in a variable in a simple template string without curly braces as a map is found', () => {
    const gradleFile = `String mysqlVersion = "6.0.5"
               compile group  : 'mysql'               ,
               name           : 'mysql-connector-java',
               version        : "$mysqlVersion"
               `;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `String mysqlVersion = "7.0.0"
               compile group  : 'mysql'               ,
               name           : 'mysql-connector-java',
               version        : "$mysqlVersion"
               `
    );
  });

  it('returns an updated file if the version defined in a variable in a simple template string with curly braces as a map is found', () => {
    const gradleFile = `String mysqlVersion = "6.0.5"
               compile group  : 'mysql'               ,
               name           : 'mysql-connector-java',
               version        : "\${mysqlVersion}"
               `;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `String mysqlVersion = "7.0.0"
               compile group  : 'mysql'               ,
               name           : 'mysql-connector-java',
               version        : "\${mysqlVersion}"
               `
    );
  });

  it('returns an updated file if the version defined in a variable in a simple template string with curly braces as a map is found in a different order', () => {
    const gradleFile = `String mysqlVersion = "6.0.5"
               compile name   : 'mysql-connector-java',
               version        : "\${mysqlVersion}",
               group          : 'mysql'
               `;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `String mysqlVersion = "7.0.0"
               compile name   : 'mysql-connector-java',
               version        : "\${mysqlVersion}",
               group          : 'mysql'
               `
    );
  });

  it('returns an updated file if the version defined in a variable in a triple template string without curly braces as a map is found', () => {
    const gradleFile = `String mysqlVersion = "6.0.5"
               compile group  : 'mysql'               ,
               name           : 'mysql-connector-java',
               version        : """$mysqlVersion"""
               `;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `String mysqlVersion = "7.0.0"
               compile group  : 'mysql'               ,
               name           : 'mysql-connector-java',
               version        : """$mysqlVersion"""
               `
    );
  });

  it('returns an updated file if the version defined in a variable in a triple template string with curly braces as a map is found', () => {
    const gradleFile = `String mysqlVersion = "6.0.5"
               compile group  : 'mysql'               ,
               name           : 'mysql-connector-java',
               version        : """\${mysqlVersion}"""
               `;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `String mysqlVersion = "7.0.0"
               compile group  : 'mysql'               ,
               name           : 'mysql-connector-java',
               version        : """\${mysqlVersion}"""
               `
    );
  });

  it('should returns a file updated if the version defined in a variable as a Kotlin named argument is found', () => {
    const gradleFile = `val mysqlVersion = "6.0.5"
               compile(group = "mysql"               ,
               name          = "mysql-connector-java",
               version       = mysqlVersion)
               `;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `val mysqlVersion = "7.0.0"
               compile(group = "mysql"               ,
               name          = "mysql-connector-java",
               version       = mysqlVersion)
               `
    );
  });

  it('should returns a file updated if the version defined in a variable as a Kotlin named argument is found in a different order', () => {
    const gradleFile = `val mysqlVersion = "6.0.5"
               compile(name  = "mysql-connector-java",
               group         = "mysql"               ,
               version       = mysqlVersion)
               `;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `val mysqlVersion = "7.0.0"
               compile(name  = "mysql-connector-java",
               group         = "mysql"               ,
               version       = mysqlVersion)
               `
    );
  });

  it('returns an updated file if the version defined in a variable in a template string without curly braces as a Kotlin named argument is found', () => {
    const gradleFile = `val mysqlVersion = "6.0.5"
               compile(group = "mysql"               ,
               name          = "mysql-connector-java",
               version       = "$mysqlVersion")
               `;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `val mysqlVersion = "7.0.0"
               compile(group = "mysql"               ,
               name          = "mysql-connector-java",
               version       = "$mysqlVersion")
               `
    );
  });

  it('returns an updated file if the version defined in a variable in a template string with curly braces as a Kotlin named argument is found', () => {
    const gradleFile = `val mysqlVersion = "6.0.5"
               compile(group = "mysql"               ,
               name          = "mysql-connector-java",
               version       = "\${mysqlVersion}")
               `;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `val mysqlVersion = "7.0.0"
               compile(group = "mysql"               ,
               name          = "mysql-connector-java",
               version       = "\${mysqlVersion}")
               `
    );
  });

  it('returns an updated file if the version defined in a variable in a template string with curly braces as a Kotlin named argument is found in a different order', () => {
    const gradleFile = `val mysqlVersion = "6.0.5"
               compile(version = "\${mysqlVersion}"    ,
               name            = "mysql-connector-java",
               group           = "mysql")
               `;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `val mysqlVersion = "7.0.0"
               compile(version = "\${mysqlVersion}"    ,
               name            = "mysql-connector-java",
               group           = "mysql")
               `
    );
  });

  it('returns an updated file if the plugin version defined in a variable is found', () => {
    const gradleFile = `val mysqlVersion = "6.0.5"
               id("mysql") version mysqlVersion
               `;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `val mysqlVersion = "7.0.0"
               id("mysql") version mysqlVersion
               `
    );
  });

  it('returns an updated file if the plugin version defined in a variable in a template string without curly braces is found', () => {
    const gradleFile = `val mysqlVersion = "6.0.5"
               id("mysql") version "$mysqlVersion"
               `;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `val mysqlVersion = "7.0.0"
               id("mysql") version "$mysqlVersion"
               `
    );
  });

  it('returns an updated file if the plugin version defined in a variable in a template string with curly braces is found', () => {
    const gradleFile = `val mysqlVersion = "6.0.5"
               id("mysql") version "\${mysqlVersion}"
               `;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `val mysqlVersion = "7.0.0"
               id("mysql") version "\${mysqlVersion}"
               `
    );
  });

  it('returns an updated file if the plugin version defined in a variable in a template string with triple double quotes is found', () => {
    const gradleFile = `String mysqlVersion = "6.0.5"
               id 'mysql' version """$mysqlVersion"""
               `;
    const updatedGradleFile = updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      `String mysqlVersion = "7.0.0"
               id 'mysql' version """$mysqlVersion"""
               `
    );
  });

  it('should replace a external groovy variable assigned to a specific dependency', () => {
    const gradleFile =
      'runtime (  "mysql:mysql-connector-java:${mysqlVersion}"  )'; // eslint-disable-line no-template-curly-in-string
    const mysqlDependency = {
      group: 'mysql',
      depGroup: 'mysql',
      name: 'mysql-connector-java',
      version: '6.0.5',
    };
    collectVersionVariables([mysqlDependency], gradleFile);

    const gradleWithVersionFile = 'String mysqlVersion = "6.0.5"';
    const updatedGradleFile = updateGradleVersion(
      gradleWithVersionFile,
      mysqlDependency,
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual('String mysqlVersion = "7.0.0"');
  });

  it('should replace a external groovy map variable assigned to a specific dependency', () => {
    const gradleFile =
      'runtime (  "mysql:mysql-connector-java:${versions.mysqlVersion}"  )'; // eslint-disable-line no-template-curly-in-string
    const mysqlDependency = {
      group: 'mysql',
      depGroup: 'mysql',
      name: 'mysql-connector-java',
      version: '6.0.5',
    };
    collectVersionVariables([mysqlDependency], gradleFile);

    const gradleWithVersionFile = 'ext.versions = [ mysqlVersion: "6.0.5" ]';
    const updatedGradleFile = updateGradleVersion(
      gradleWithVersionFile,
      mysqlDependency,
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      'ext.versions = [ mysqlVersion: "7.0.0" ]'
    );
  });

  it('should replace a external groovy map nested variable assigned to a specific dependency', () => {
    const gradleFile =
      'runtime (  "mysql:mysql-connector-java:${versions.nested.mysqlVersion}"  )'; // eslint-disable-line no-template-curly-in-string
    const mysqlDependency = {
      group: 'mysql',
      depGroup: 'mysql',
      name: 'mysql-connector-java',
      version: '6.0.5',
    };
    collectVersionVariables([mysqlDependency], gradleFile);

    const gradleWithVersionFile =
      'ext.versions = [ nested: [ mysqlVersion: "6.0.5" ] ]';
    const updatedGradleFile = updateGradleVersion(
      gradleWithVersionFile,
      mysqlDependency,
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      'ext.versions = [ nested: [ mysqlVersion: "7.0.0" ] ]'
    );
  });

  it('should replace a external property variable assigned to a specific dependency', () => {
    const gradleFile =
      'runtime (  "mysql:mysql-connector-java:${mysqlVersion}"  )'; // eslint-disable-line no-template-curly-in-string
    const mysqlDependency = {
      group: 'mysql',
      depGroup: 'mysql',
      name: 'mysql-connector-java',
      version: '6.0.5',
    };
    collectVersionVariables([mysqlDependency], gradleFile);

    const propertyFile = 'mysqlVersion=6.0.5';
    const updatedGradleFile = updateGradleVersion(
      propertyFile,
      mysqlDependency,
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual('mysqlVersion=7.0.0');
  });

  it('should replace a external property variable assigned to a specific dependency parenthesis syntax', () => {
    const gradleFile =
      "implementation platform(group: 'mysql', name: 'mysql-connector-java', version: mysqlVersion)"; // eslint-disable-line no-template-curly-in-string
    const mysqlDependency = {
      group: 'mysql',
      depGroup: 'mysql',
      name: 'mysql-connector-java',
      version: '6.0.5',
    };
    collectVersionVariables([mysqlDependency], gradleFile);

    const propertyFile = 'mysqlVersion=6.0.5';
    const updatedGradleFile = updateGradleVersion(
      propertyFile,
      mysqlDependency,
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual('mysqlVersion=7.0.0');
  });

  it('should replace a external variable assigned to a map dependency', () => {
    const gradleFile = `compile group  : 'mysql'               ,
               name           : 'mysql-connector-java',
               version        : mysqlVersion
               `;
    const mysqlDependency = {
      group: 'mysql',
      depGroup: 'mysql',
      name: 'mysql-connector-java',
      version: '6.0.5',
    };
    collectVersionVariables([mysqlDependency], gradleFile);

    const gradleWithVersionFile = 'String mysqlVersion = "6.0.5"';
    const updatedGradleFile = updateGradleVersion(
      gradleWithVersionFile,
      mysqlDependency,
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual('String mysqlVersion = "7.0.0"');
  });

  it('should replace a external variable assigned to a Kotlin named argument dependency', () => {
    const gradleFile = `compile(group  = "mysql"               ,
               name           = "mysql-connector-java",
               version        = mysqlVersion)
               `;
    const mysqlDependency = {
      group: 'mysql',
      depGroup: 'mysql',
      name: 'mysql-connector-java',
      version: '6.0.5',
    };
    collectVersionVariables([mysqlDependency], gradleFile);

    const gradleWithVersionFile = 'val mysqlVersion = "6.0.5"';
    const updatedGradleFile = updateGradleVersion(
      gradleWithVersionFile,
      mysqlDependency,
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual('val mysqlVersion = "7.0.0"');
  });

  it('should replace a external variable assigned to a interpolated dependency', () => {
    const gradleFile =
      'runtime (  "mysql:mysql-connector-java:$mysqlVersion"  )';
    const mysqlDependency = {
      group: 'mysql',
      depGroup: 'mysql',
      name: 'mysql-connector-java',
      version: '6.0.5',
    };
    collectVersionVariables([mysqlDependency], gradleFile);

    const gradleWithVersionFile = 'String mysqlVersion = "6.0.5"';
    const updatedGradleFile = updateGradleVersion(
      gradleWithVersionFile,
      mysqlDependency,
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual('String mysqlVersion = "7.0.0"');
  });

  it('should replace a external extra variable assigned to a Kotlin named argument dependency', () => {
    const gradleFile = `compile(group  = "mysql"               ,
               name           = "mysql-connector-java",
               version        = mysqlVersion)
               `;
    const mysqlDependency = {
      group: 'mysql',
      depGroup: 'mysql',
      name: 'mysql-connector-java',
      version: '6.0.5',
    };
    collectVersionVariables([mysqlDependency], gradleFile);

    const gradleWithVersionFile = 'val mysqlVersion by extra("6.0.5")';
    const updatedGradleFile = updateGradleVersion(
      gradleWithVersionFile,
      mysqlDependency,
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual('val mysqlVersion by extra("7.0.0")');
  });

  it('should replace a external lazy extra variable assigned to a Kotlin named argument dependency', () => {
    const gradleFile = `compile(group  = "mysql"               ,
               name           = "mysql-connector-java",
               version        = mysqlVersion)
               `;
    const mysqlDependency = {
      group: 'mysql',
      depGroup: 'mysql',
      name: 'mysql-connector-java',
      version: '6.0.5',
    };
    collectVersionVariables([mysqlDependency], gradleFile);

    const gradleWithVersionFile = 'val mysqlVersion by extra { "6.0.5" }';
    const updatedGradleFile = updateGradleVersion(
      gradleWithVersionFile,
      mysqlDependency,
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual('val mysqlVersion by extra { "7.0.0" }');
  });

  it('should replace a external variable assigned to a plugin dependency', () => {
    const gradleFile = 'id("mysql") version "$mysqlVersion";';
    const mysqlDependency = {
      group: 'mysql',
      depGroup: 'mysql',
      name: 'mysql-connector-java',
      version: '6.0.5',
    };
    collectVersionVariables([mysqlDependency], gradleFile);

    const gradleWithVersionFile = 'String mysqlVersion = "6.0.5"';
    const updatedGradleFile = updateGradleVersion(
      gradleWithVersionFile,
      mysqlDependency,
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual('String mysqlVersion = "7.0.0"');
  });
});
