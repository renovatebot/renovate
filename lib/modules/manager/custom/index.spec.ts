import * as customManager from '.';

describe('modules/manager/custom/index', () => {
  it('has default config', () => {
    expect(customManager.defaultConfig).toEqual({});
  });

  it('gets something', () => {
    expect(
      customManager.get('custom.regex', 'extractPackageFile')
    ).not.toBeNull();
  });

  it('getCustomManagerList', () => {
    expect(customManager.getCustomManagerList()).not.toBeNull();
  });

  it('returns null if customType not found', async () => {
    const config = {
      matchStrings: [
        'ENV .*?_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>[^&]*?)(\\&versioning=(?<versioning>[^&]*?))?\\s',
      ],
      versioningTemplate:
        '{{#if versioning}}{{versioning}}{{else}}semver{{/if}}',
    };
    const res = await customManager.extractPackageFile(
      '',
      'Dockerfile',
      config
    );
    expect(res).toBeNull();
  });

  it('returns null if custom manager name is invalid', async () => {
    const config = {
      customType: 'invalid_manager',
      matchStrings: [
        'ENV .*?_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>[^&]*?)(\\&versioning=(?<versioning>[^&]*?))?\\s',
      ],
      versioningTemplate:
        '{{#if versioning}}{{versioning}}{{else}}semver{{/if}}',
    };
    const res = await customManager.extractPackageFile(
      '',
      'Dockerfile',
      config
    );
    expect(res).toBeNull();
  });

  it('returns null if custom manager does not have extract function', async () => {
    customManager.getCustomManagers().set('dummy', {
      defaultConfig: {},
      supportedDatasources: [],
    });
    const config = {
      customType: 'dummy',
      matchStrings: [
        'ENV .*?_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>[^&]*?)(\\&versioning=(?<versioning>[^&]*?))?\\s',
      ],
      versioningTemplate:
        '{{#if versioning}}{{versioning}}{{else}}semver{{/if}}',
    };
    const res = await customManager.extractPackageFile(
      '',
      'Dockerfile',
      config
    );
    expect(res).toBeNull();
    customManager.getCustomManagers().delete('dummy');
  });

  it('returns non-null', async () => {
    customManager.getCustomManagers().set('dummy', {
      defaultConfig: {},
      supportedDatasources: [],
      extractPackageFile: () => Promise.resolve({ deps: [] }),
    });
    const config = {
      customType: 'dummy',
      matchStrings: [
        'ENV .*?_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>[^&]*?)(\\&versioning=(?<versioning>[^&]*?))?\\s',
      ],
      versioningTemplate:
        '{{#if versioning}}{{versioning}}{{else}}semver{{/if}}',
    };
    const res = await customManager.extractPackageFile(
      '',
      'Dockerfile',
      config
    );
    expect(res).not.toBeNull();
    customManager.getCustomManagers().delete('dummy');
  });
});
