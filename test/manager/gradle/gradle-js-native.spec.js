jest.mock('fs-extra');
jest.mock('child-process-promise');

const { exec } = require('child-process-promise');
const fs = require('fs-extra');

const realFs = jest.requireActual('fs-extra');
const path = require('path');

const manager = require('../../../lib/manager/gradle/index');
const { initLogger } = require('../../../lib/logger');

initLogger();

describe('manager/gradle js parser', () => {
  let origGetFile;

  beforeAll(() => {
    origGetFile = platform.getFile;
  });

  beforeEach(() => {
    fs.mkdir.mockReturnValue(true);
    fs.exists.mockReturnValue(true);
    fs.readFile.mockImplementation(file => {
      const filepath = path.join(__dirname, '_fixtures', file);
      return realFs.readFileSync(filepath, 'utf8');
    });
    exec.mockReturnValue({ stdout: 'gradle output', stderr: '' });
  });

  afterEach(() => {
    jest.resetAllMocks();
    platform.getFile = origGetFile;
  });

  it('extract all dependencies', async () => {
    mockGetFile('generic');
    const dependencies = await manager.extractAllPackageFiles(buildConfig(), [
      'build.gradle',
    ]);

    // prettier-ignore
    expect(dependencies).toEqual([{
      packageFile: "build.gradle",
      manager: "gradle",
      datasource: "maven",
      deps:[
        plugin('com.jfrog.bintray', '0.4.1'),
        library({group: 'org.springframework.boot', name: 'spring-boot-starter-jersey', version: null}),
        library({group: 'org.spockframework', name: 'spock-core', version: '1.0-groovy-2.4'}),
        library({group: 'cglib', name: 'cglib-nodep', version: '3.1'}),
      ]
    }]);
  });

  it('finds nothing in empty plugins section', async () => {
    platform.getFile = () => {
      return `
      plugins {}
      `;
    };

    const dependencies = await manager.extractAllPackageFiles(buildConfig(), [
      'build.gradle',
    ]);
    // prettier-ignore
    expect(dependencies).toEqual([{
      packageFile: "build.gradle",
      manager: "gradle",
      datasource: "maven",
      deps:[
        library({group: 'org.springframework.boot', name: 'spring-boot-starter-jersey', version: null}),
        library({group: 'org.spockframework', name: 'spock-core', version: '1.0-groovy-2.4'}),
        library({group: 'cglib', name: 'cglib-nodep', version: '3.1'}),
      ]
    }]);
  });

  it('finds nothing if there is only core plugins defined', async () => {
    platform.getFile = () => {
      return `
      plugins {
        id 'java'
        id 'idea'
      }
      `;
    };

    const dependencies = await manager.extractAllPackageFiles(buildConfig(), [
      'build.gradle',
    ]);
    // prettier-ignore
    expect(dependencies).toEqual([
      packageFile({
        file: 'build.gradle',
        deps: [
          library({group: 'org.springframework.boot', name: 'spring-boot-starter-jersey', version: null}),
          library({group: 'org.spockframework', name: 'spock-core', version: '1.0-groovy-2.4'}),
          library({group: 'cglib', name: 'cglib-nodep', version: '3.1'}),
        ]
      })
    ]);
  });

  it('should returns plugins defined in subprojects', async () => {
    mockGetFile('subprojects');
    const config = buildConfig({ disableGradleExecution: true });
    const dependencies = await manager.extractAllPackageFiles(config, [
      'build.gradle',
      'subproject1/build.gradle',
      'subproject2/build.gradle',
      'subproject1/subproject3/build.gradle',
    ]);

    expect(dependencies).toEqual([
      packageFile({
        file: 'build.gradle',
        deps: [plugin('com.jfrog.bintray', '0.4.1')],
      }),
      packageFile({
        file: 'subproject1/build.gradle',
        deps: [plugin('no-version-plugin')],
      }),
      packageFile({
        file: 'subproject2/build.gradle',
        deps: [plugin('com.jfrog.bintray', '0.4.1')],
      }),
      packageFile({
        file: 'subproject1/subproject3/build.gradle',
        deps: [plugin('submodule-plugin', '1.2.4')],
      }),
    ]);
  });
});

function packageFile({ file, deps }) {
  return {
    packageFile: file,
    manager: 'gradle',
    datasource: 'maven',
    deps,
  };
}

function plugin(id, version) {
  const dep = {
    depName: `Gradle Plugin ${id}`,
    group: id,
    name: `${id}.gradle.plugin`,
    registryUrls: ['https://plugins.gradle.org/m2/'],
  };
  if (version) {
    dep.currentValue = version;
  }
  return dep;
}

function library({ group, name, version }) {
  return {
    currentValue: version,
    depGroup: group,
    depName: `${group}:${name}`,
    name,
    registryUrls: [
      'https://repo.maven.apache.org/maven2/',
      'https://jitpack.io',
    ],
  };
}

function mockGetFile(base) {
  const currentDir = __dirname;
  platform.getFile = file => {
    const filepath = path.join(currentDir, '_fixtures', base, file);
    return realFs.readFileSync(filepath, 'utf8');
  };
}

function buildConfig(
  { useJsParser = true, disableGradleExecution = false } = {
    useJsParser: true,
    disableGradleExecution: false,
  }
) {
  return {
    localDir: 'localDir',
    gradle: {
      timeout: 20,
      useJsParser,
      disableGradleExecution,
    },
  };
}
