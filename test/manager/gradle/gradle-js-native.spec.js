
const manager = require('../../../lib/manager/gradle/index');

const config = {
  localDir: 'localDir',
  gradle: {
    timeout: 20,
  },
};

describe('manager/gradle js parser', () => {

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('Return plugin dependencies', async () => {
    const gradleContent = `
    plugins {
      id 'com.jfrog.bintray' version '0.4.1'
      id 'java'
    }
    `;

    platform.getFile.mockReturnValue(gradleContent);
    const dependencies = await manager.extractAllPackageFiles(config, [
      'build.gradle',
    ]);

    expect(dependencies).toEqual([{
      packageFile: "build.gradle",
      manager: "gradle",
      datasource: "maven",
      deps:[{
        depName: "com.jfrog.bintray",
        name: "Gradle Plugin com.jfrog.bintray",
        currentValue: "0.4.1"
      },{
        depName: "java",
        name: "Gradle Plugin java"
      }]
    }]);
  });
});
