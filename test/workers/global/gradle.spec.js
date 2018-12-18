const fs = require('fs-extra');

const globalWorker = require('../../../lib/workers/global');

jest.mock('../../../lib/config/cli');
jest.mock('../../../lib/config/file');

const fileConfigMocked = require('../../../lib/config/file');
const cliConfigMocked = require('../../../lib/config/cli');

const platform = require('../../../lib/platform/dummy');

const renovateJson = `
{
  "prHourlyLimit": "100",
  "gradle": {
    "enabled": true
  },
  "extends": [
    "config:base"
  ]
}
`;

describe('lib/workers/global', () => {
  jest.setTimeout(25000);

  beforeEach(() => {
    jest.resetAllMocks();
    cliConfigMocked.getConfig = jest.fn(() => []);
    const config = {
      enabled: true,
      platform: 'dummy',
      logFileLevel: 'warn',
      token: 'token',
      endpoint: 'endpoint',
      logLevel: 'debug',
      onboarding: true,
      onboardingConfig: {
        extends: ['config:base'],
      },
      repositories: ['ibethencourt/example-project'],
    };
    fileConfigMocked.getConfig = jest.fn(() => config);

    platform.initDummy();
    platform.createFile('renovate.json', renovateJson);
  });

  it('processes repositories', async () => {
    platform.createFile(
      'build.gradle',
      fs.readFileSync('test/_fixtures/gradle/build.gradle.example1', 'utf8')
    );
    await globalWorker.start();
    expect(platform.prs.map(pr => pr.title)).toEqual([
      'Update dependency mysql:mysql-connector-java to 8.0.12',
    ]);
  });

  it('should log errors in gradle execution', async () => {
    platform.createFile(
      'build.gradle',
      fs.readFileSync('test/_fixtures/gradle/build.gradle.error1', 'utf8')
    );
    await globalWorker.start();
    expect(platform.prs).toEqual([]);
  });

  it('should generate pr for dependencies in subprojects', async () => {
    platform.createFile(
      'settings.gradle',
      fs.readFileSync(
        'test/_fixtures/gradle/settings_multi_project.gradle',
        'utf8'
      )
    );
    platform.createFile(
      'build.gradle',
      fs.readFileSync(
        'test/_fixtures/gradle/build.gradle.multi_project1',
        'utf8'
      )
    );
    platform.createFile(
      'subproject1/build.gradle',
      fs.readFileSync('test/_fixtures/gradle/build.gradle.subproject1', 'utf8')
    );
    platform.createFile(
      'subproject1/subproject2/build.gradle',
      fs.readFileSync('test/_fixtures/gradle/build.gradle.subproject2', 'utf8')
    );

    await globalWorker.start();

    expect(platform.prs.map(pr => pr.title)).toEqual([
      'Update dependency backport-util-concurrent:backport-util-concurrent to 3.1',
      'Update dependency mysql:mysql-connector-java to 8.0.12',
      'Update dependency org.hamcrest:hamcrest-core to 2.1-rc3',
    ]);

    expect(
      Array.from(
        platform.branches.get('renovate/backport-util-concurrent-backport-util-concurrent-.x').keys()
      )
    ).toEqual(['build.gradle']);
    expect(
      Array.from(
        platform.branches.get('renovate/mysql-mysql-connector-java-.x').keys()
      )
    ).toEqual(['subproject1/subproject2/build.gradle']);
    expect(
      Array.from(
        platform.branches
          .get('renovate/org.hamcrest-hamcrest-core-.x')
          .keys()
      )
    ).toEqual(['subproject1/build.gradle']);
  });
});
