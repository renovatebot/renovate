const gradle = require('../../../lib/manager/gradle/build-gradle');

describe('lib/manager/gradle/updateGradleVersion', () => {
  it('returns the same file if dependency is null', () => {
    const gradleFile = "runtime('mysql:mysql-connector-java:6.0.5')";
    const updatedGradleFile = gradle.updateGradleVersion(
      gradleFile,
      null,
      null
    );
    expect(updatedGradleFile).toEqual(gradleFile);
  });

  it('returns the same file if version is not found', () => {
    const gradleFile = "runtime('mysql:mysql-connector-java:6.0.5')";
    const updatedGradleFile = gradle.updateGradleVersion(
      gradleFile,
      { group: 'org.codehaus.groovy', name: 'groovy', version: '2.4.9' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(gradleFile);
  });

  it('returns a file updated if the version is found', () => {
    const gradleFile = "runtime (  'mysql:mysql-connector-java:6.0.5'  )";
    const updatedGradleFile = gradle.updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(
      "runtime (  'mysql:mysql-connector-java:7.0.0'  )"
    );
  });

  it('returns a file updated if the version defined as map is found', () => {
    const gradleFile = `compile group  : 'mysql'               , 
               name   : 'mysql-connector-java', 
               version: '6.0.5'`;
    const updatedGradleFile = gradle.updateGradleVersion(
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

  it('should returns a file updated if the version defined in a variable as a string is found', () => {
    const gradleFile = `String mysqlVersion = "6.0.5"
    runtime (  'mysql:mysql-connector-java:$mysqlVersion'  )
    `;
    const updatedGradleFile = gradle.updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(`String mysqlVersion = "7.0.0"
    runtime (  'mysql:mysql-connector-java:$mysqlVersion'  )
    `);
  });

  it('should returns a file updated if the version defined in a expression as a string is found', () => {
    const gradleFile = `String mysqlVersion = "6.0.5"
    runtime (  'mysql:mysql-connector-java:\${mysqlVersion}'  )
    `;
    const updatedGradleFile = gradle.updateGradleVersion(
      gradleFile,
      { group: 'mysql', name: 'mysql-connector-java', version: '6.0.5' },
      '7.0.0'
    );
    expect(updatedGradleFile).toEqual(`String mysqlVersion = "7.0.0"
    runtime (  'mysql:mysql-connector-java:\${mysqlVersion}'  )
    `);
  });

  it('should returns a file updated if the version defined in a variable as a map is found', () => {
    const gradleFile = `String mysqlVersion = "6.0.5"
               compile group  : 'mysql'               , 
               name           : 'mysql-connector-java', 
               version        : mysqlVersion
               `;
    const updatedGradleFile = gradle.updateGradleVersion(
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
});
