import { logger } from '../../../../../test/util';
import type { JsonataExtractConfig } from './types';
import { defaultConfig, extractPackageFile } from '.';

describe('modules/manager/custom/jsonata/index', () => {
  it('has default config', () => {
    expect(defaultConfig).toEqual({
      pinDigests: false,
    });
  });

  it('extracts data when no templates are used', async () => {
    const json = `
    {
    "packages": [
      {
        "dep_name": "foo",
        "package_name": "fii",
        "current_value": "1.2.3",
        "current_digest": "1234",
        "data_source": "nuget",
        "versioning": "maven",
        "extract_version": "custom-extract-version",
        "registry_url": "https://registry.npmjs.org",
        "dep_type": "dev"
      }
      ]
    }`;
    const config = {
      matchStrings: [
        `packages.{
            "depName": dep_name,
            "packageName": package_name,
            "currentValue": current_value,
            "currentDigest": current_digest,
            "datasource": data_source,
            "versioning": versioning,
            "extractVersion": extract_version,
            "registryUrl": registry_url,
            "depType": dep_type
        }`,
      ],
    };
    const res = await extractPackageFile(json, 'unused', config);

    expect(res?.deps).toHaveLength(1);
    expect(res?.deps.filter((dep) => dep.depName === 'foo')).toHaveLength(1);
    expect(res?.deps.filter((dep) => dep.packageName === 'fii')).toHaveLength(
      1,
    );
    expect(
      res?.deps.filter((dep) => dep.currentValue === '1.2.3'),
    ).toHaveLength(1);
    expect(
      res?.deps.filter((dep) => dep.currentDigest === '1234'),
    ).toHaveLength(1);
    expect(res?.deps.filter((dep) => dep.datasource === 'nuget')).toHaveLength(
      1,
    );
    expect(res?.deps.filter((dep) => dep.versioning === 'maven')).toHaveLength(
      1,
    );
    expect(
      res?.deps.filter(
        (dep) => dep.extractVersion === 'custom-extract-version',
      ),
    ).toHaveLength(1);
    expect(
      res?.deps.filter((dep) =>
        dep.registryUrls?.includes('https://registry.npmjs.org/'),
      ),
    ).toHaveLength(1);
    expect(res?.deps.filter((dep) => dep.depType === 'dev')).toHaveLength(1);
  });

  it('applies templates', async () => {
    const json = `
    {
    "packages": [
      {
        "dep_name": "foo",
        "package_name": "fii",
        "current_value": "1.2.3",
        "current_digest": "1234",
        "data_source": "nuget",
        "versioning": "maven",
        "extract_version": "custom-extract-version",
        "registry_url": "https://registry.npmjs.org",
        "dep_type": "dev"
      },
      {
      }]
    }`;
    const config = {
      matchStrings: [
        `packages.{
            "depName": dep_name,
            "packageName": package_name,
            "currentValue": current_value,
            "currentDigest": current_digest,
            "datasource": data_source,
            "versioning": versioning,
            "extractVersion": extract_version,
            "registryUrl": registry_url,
            "depType": dep_type
        }`,
      ],
      depNameTemplate:
        '{{#if depName}}{{depName}}{{else}}default-dep-name{{/if}}',
      packageNameTemplate:
        '{{#if packageName}}{{packageName}}{{else}}default-package-name{{/if}}',
      currentValueTemplate:
        '{{#if currentValue}}{{currentValue}}{{else}}default-current-value{{/if}}',
      currentDigestTemplate:
        '{{#if currentDigest}}{{currentDigest}}{{else}}default-current-digest{{/if}}',
      datasourceTemplate:
        '{{#if datasource}}{{datasource}}{{else}}default-datasource{{/if}}',
      versioningTemplate:
        '{{#if versioning}}{{versioning}}{{else}}default-versioning{{/if}}',
      extractVersionTemplate:
        '{{#if extractVersion}}{{extractVersion}}{{else}}default-extract-version{{/if}}',
      registryUrlTemplate:
        '{{#if registryUrl}}{{registryUrl}}{{else}}https://default.registry.url{{/if}}',
      depTypeTemplate:
        '{{#if depType}}{{depType}}{{else}}default-dep-type{{/if}}',
    };
    const res = await extractPackageFile(json, 'unused', config);

    expect(res?.deps).toHaveLength(2);

    expect(res?.deps.filter((dep) => dep.depName === 'foo')).toHaveLength(1);
    expect(res?.deps.filter((dep) => dep.packageName === 'fii')).toHaveLength(
      1,
    );
    expect(
      res?.deps.filter((dep) => dep.currentValue === '1.2.3'),
    ).toHaveLength(1);
    expect(
      res?.deps.filter((dep) => dep.currentDigest === '1234'),
    ).toHaveLength(1);
    expect(res?.deps.filter((dep) => dep.datasource === 'nuget')).toHaveLength(
      1,
    );
    expect(res?.deps.filter((dep) => dep.versioning === 'maven')).toHaveLength(
      1,
    );
    expect(
      res?.deps.filter(
        (dep) => dep.extractVersion === 'custom-extract-version',
      ),
    ).toHaveLength(1);
    expect(
      res?.deps.filter((dep) =>
        dep.registryUrls?.includes('https://registry.npmjs.org/'),
      ),
    ).toHaveLength(1);
    expect(res?.deps.filter((dep) => dep.depType === 'dev')).toHaveLength(1);

    expect(
      res?.deps.filter((dep) => dep.depName === 'default-dep-name'),
    ).toHaveLength(1);
    expect(
      res?.deps.filter((dep) => dep.packageName === 'default-package-name'),
    ).toHaveLength(1);
    expect(
      res?.deps.filter((dep) => dep.currentValue === 'default-current-value'),
    ).toHaveLength(1);
    expect(
      res?.deps.filter((dep) => dep.currentDigest === 'default-current-digest'),
    ).toHaveLength(1);
    expect(
      res?.deps.filter((dep) => dep.datasource === 'default-datasource'),
    ).toHaveLength(1);
    expect(
      res?.deps.filter((dep) => dep.versioning === 'default-versioning'),
    ).toHaveLength(1);
    expect(
      res?.deps.filter(
        (dep) => dep.extractVersion === 'default-extract-version',
      ),
    ).toHaveLength(1);
    expect(
      res?.deps.filter((dep) =>
        dep.registryUrls?.includes('https://default.registry.url/'),
      ),
    ).toHaveLength(1);
    expect(
      res?.deps.filter((dep) => dep.depType === 'default-dep-type'),
    ).toHaveLength(1);
  });

  it('returns null when content is not json', async () => {
    const res = await extractPackageFile(
      'not-json',
      'foo-file',
      {} as JsonataExtractConfig,
    );
    expect(res).toBeNull();
    expect(logger.logger.warn).toHaveBeenCalledWith(
      expect.anything(),
      'File is not a valid JSON file.',
    );
  });

  it('returns null when no content', async () => {
    const res = await extractPackageFile(
      '',
      'foo-file',
      {} as JsonataExtractConfig,
    );
    expect(res).toBeNull();
  });

  it('returns null if no dependencies found', async () => {
    const config = {
      matchStrings: [
        'packages.{ "depName": package, "currentValue": version, "versioning ": versioning }',
      ],
    };
    const res = await extractPackageFile('{}', 'unused', config);
    expect(res).toBeNull();
  });

  it('returns null if invalid template', async () => {
    const config = {
      matchStrings: [`{"depName": "foo"}`],
      versioningTemplate: '{{#if versioning}}{{versioning}}{{else}}semver', // invalid template
    };
    const res = await extractPackageFile('{}', 'unused', config);
    expect(res).toBeNull();
    expect(logger.logger.warn).toHaveBeenCalledWith(
      expect.anything(),
      'Error compiling template for JSONata manager',
    );
  });

  it('extracts and does not apply a registryUrlTemplate if the result is an invalid url', async () => {
    const config = {
      matchStrings: [`{"depName": "foo"}`],
      registryUrlTemplate: 'this-is-not-a-valid-url-{{depName}}',
    };
    const res = await extractPackageFile('{}', 'unused', config);
    expect(res).not.toBeNull();
    expect(logger.logger.warn).toHaveBeenCalledWith(
      { value: 'this-is-not-a-valid-url-foo' },
      'Invalid JSONata manager registryUrl',
    );
  });

  it('extracts multiple dependencies with multiple matchStrings', async () => {
    const config = {
      matchStrings: [`{"depName": "foo"}`, `{"depName": "bar"}`],
    };
    const res = await extractPackageFile('{}', 'unused', config);
    expect(res?.deps).toHaveLength(2);
  });

  it('excludes and warns if invalid jsonata query found', async () => {
    const config = {
      matchStrings: ['{', `{"depName": "foo"}`, `{"depName": "bar"}`],
    };
    const res = await extractPackageFile('{}', 'unused', config);
    expect(res?.deps).toHaveLength(2);
    expect(logger.logger.warn).toHaveBeenCalledWith(
      { err: expect.any(Object) },
      `Failed to compile JSONata query: {. Excluding it from queries.`,
    );
  });

  it('extracts dependency with autoReplaceStringTemplate', async () => {
    const config = {
      matchStrings: [`{"depName": "foo"}`],
      autoReplaceStringTemplate: 'auto-replace-string-template',
    };
    const res = await extractPackageFile('{}', 'values.yaml', config);
    expect(res?.autoReplaceStringTemplate).toBe('auto-replace-string-template');
  });
});
