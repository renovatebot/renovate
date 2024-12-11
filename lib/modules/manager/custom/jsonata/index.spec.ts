import { codeBlock } from 'common-tags';
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
    const json = codeBlock`
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
      fileFormat: 'json',
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

    expect(res).toMatchObject({
      deps: [
        {
          depName: 'foo',
          packageName: 'fii',
          currentValue: '1.2.3',
          currentDigest: '1234',
          datasource: 'nuget',
          versioning: 'maven',
          extractVersion: 'custom-extract-version',
          registryUrls: ['https://registry.npmjs.org/'],
          depType: 'dev',
        },
      ],
      matchStrings: config.matchStrings,
    });
  });

  it('applies templates', async () => {
    const json = codeBlock`
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
      fileFormat: 'json',
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

    expect(res).toMatchObject({
      deps: [
        {
          depName: 'foo',
          packageName: 'fii',
          currentValue: '1.2.3',
          currentDigest: '1234',
          datasource: 'nuget',
          versioning: 'maven',
          extractVersion: 'custom-extract-version',
          registryUrls: ['https://registry.npmjs.org/'],
          depType: 'dev',
        },
        {
          depName: 'default-dep-name',
          packageName: 'default-package-name',
          currentValue: 'default-current-value',
          currentDigest: 'default-current-digest',
          datasource: 'default-datasource',
          versioning: 'default-versioning',
          extractVersion: 'default-extract-version',
          registryUrls: ['https://default.registry.url/'],
          depType: 'default-dep-type',
        },
      ],
      matchStrings: config.matchStrings,
    });
  });

  it('logs warning if query result does not match schema', async () => {
    const json = codeBlock`
    {
    "packages": [
      {
        "dep_name": "foo",
        "package_name": "fii",
        "current_value": 1,
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
      fileFormat: 'json',
      matchStrings: [
        `packages.{
            "depName": dep_name,
            "currentValue": current_value,
            "datasource": data_source
        }`,
      ],
    };
    const res = await extractPackageFile(json, 'unused', config);

    expect(res).toBeNull();
    expect(logger.logger.warn).toHaveBeenCalledWith(
      expect.anything(),
      'Error while parsing dep info',
    );
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
      'Invalid JSON file(parsing failed)',
    );
  });

  it('returns null when no content', async () => {
    const res = await extractPackageFile('', 'foo-file', {
      fileFormat: 'json',
      matchStrings: [
        'packages.{ "depName": package, "currentValue": version, "versioning ": versioning }',
      ],
    } as JsonataExtractConfig);
    expect(res).toBeNull();
  });

  it('returns null if no dependencies found', async () => {
    const config = {
      fileFormat: 'json',
      matchStrings: [
        'packages.{ "depName": package, "currentValue": version, "versioning ": versioning }',
      ],
    };
    const res = await extractPackageFile('{}', 'unused', config);
    expect(res).toBeNull();
  });

  it('returns null if invalid template', async () => {
    const config = {
      fileFormat: 'json',
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
      fileFormat: 'json',
      matchStrings: [`{"depName": "foo"}`],
      registryUrlTemplate: 'this-is-not-a-valid-url-{{depName}}',
    };
    const res = await extractPackageFile('{}', 'unused', config);
    expect(res).not.toBeNull();
    expect(logger.logger.warn).toHaveBeenCalledWith(
      { url: 'this-is-not-a-valid-url-foo' },
      'Invalid JSONata manager registryUrl',
    );
  });

  it('extracts multiple dependencies with multiple matchStrings', async () => {
    const config = {
      fileFormat: 'json',
      matchStrings: [`{"depName": "foo"}`, `{"depName": "bar"}`],
    };
    const res = await extractPackageFile('{}', 'unused', config);
    expect(res?.deps).toHaveLength(2);
  });

  it('excludes and warns if invalid jsonata query found', async () => {
    const config = {
      fileFormat: 'json',
      matchStrings: ['{', `{"depName": "foo"}`, `{"depName": "bar"}`],
    };
    const res = await extractPackageFile('{}', 'unused', config);
    expect(res?.deps).toHaveLength(2);
    expect(logger.logger.warn).toHaveBeenCalledWith(
      { err: expect.any(Object), query: '{' },
      'Failed to compile JSONata query',
    );
  });
});
