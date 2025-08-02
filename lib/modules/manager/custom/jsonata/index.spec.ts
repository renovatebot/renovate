import { codeBlock } from 'common-tags';
import type { JsonataExtractConfig } from './types';
import { defaultConfig, extractPackageFile } from '.';
import { logger } from '~test/util';

describe('modules/manager/custom/jsonata/index', () => {
  it('has default config', () => {
    expect(defaultConfig).toEqual({
      pinDigests: false,
    });
  });

  it('returns null when content does not match specified file format', async () => {
    const res = await extractPackageFile('not-json', 'foo-file', {
      fileFormat: 'json',
    } as JsonataExtractConfig);
    expect(res).toBeNull();
    expect(logger.logger.debug).toHaveBeenCalledWith(
      expect.anything(),
      'Error while parsing file',
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
      ...config,
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
    });
  });

  it('extracts yaml', async () => {
    const json = codeBlock`
    ---
    packages:
      -
        "dep_name": "foo"
        "package_name": "fii"
        "current_value": "1.2.3"
        "current_digest": "1234"
        "data_source": "nuget"
        "versioning": "maven"
        "extract_version": "custom-extract-version"
        "registry_url": "https://registry.npmjs.org"
        "dep_type": "dev"
    ---
    some: true
    `;
    const config = {
      fileFormat: 'yaml',
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
      ...config,
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
      ...config,
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
      'Query results failed schema validation',
    );
  });

  it('returns null if no dependencies found', async () => {
    const config = {
      fileFormat: 'json',
      matchStrings: [
        'packages.{ "depName": package, "currentValue": version, "versioning ": versioning }',
      ],
    };
    const res = await extractPackageFile('{}', 'unused', config);
    expect(logger.logger.debug).toHaveBeenCalledWith(
      {
        packageFile: 'unused',
        jsonataQuery:
          'packages.{ "depName": package, "currentValue": version, "versioning ": versioning }',
      },
      'The jsonata query returned no matches. Possible error, please check your query. Skipping',
    );
    expect(res).toBeNull();
  });

  it('returns null if invalid template', async () => {
    const config = {
      fileFormat: 'json',
      matchStrings: [
        `{"depName": "foo", "currentValue": "1.0.0", "datasource": "npm"}`,
      ],
      versioningTemplate: '{{#if versioning}}{{versioning}}{{else}}semver', // invalid template
    };
    const res = await extractPackageFile('{}', 'unused', config);
    expect(res).toBeNull();
    expect(logger.logger.debug).toHaveBeenCalledWith(
      expect.anything(),
      'Error compiling template for JSONata manager',
    );
  });

  it('extracts and does not apply a registryUrlTemplate if the result is an invalid url', async () => {
    const config = {
      fileFormat: 'json',
      matchStrings: [
        `{"depName": "foo", "currentValue": "1.0.0", "datasource": "npm"}`,
      ],
      registryUrlTemplate: 'this-is-not-a-valid-url-{{depName}}',
    };
    const res = await extractPackageFile('{}', 'unused', config);
    expect(res).not.toBeNull();
    expect(logger.logger.debug).toHaveBeenCalledWith(
      { url: 'this-is-not-a-valid-url-foo' },
      'Invalid JSONata manager registryUrl',
    );
  });

  it('extracts multiple dependencies with multiple matchStrings', async () => {
    const config = {
      fileFormat: 'json',
      matchStrings: [`{"depName": "foo"}`, `{"depName": "bar"}`],
      currentValueTemplate: '1.0.0',
      datasourceTemplate: 'npm',
    };
    const res = await extractPackageFile('{}', 'unused', config);
    expect(res).toMatchObject({
      ...config,
      deps: [
        {
          depName: 'foo',
          currentValue: '1.0.0',
          datasource: 'npm',
        },
        {
          depName: 'bar',
          currentValue: '1.0.0',
          datasource: 'npm',
        },
      ],
    });
  });

  it('extracts other matchStrings if one finds no match', async () => {
    const config = {
      fileFormat: 'json',
      matchStrings: [`packages.{ "depName": package }`, `{"depName": "bar"}`],
      currentValueTemplate: '1.0.0',
      datasourceTemplate: 'npm',
    };
    const res = await extractPackageFile('{}', 'unused', config);
    expect(logger.logger.debug).toHaveBeenCalledWith(
      {
        packageFile: 'unused',
        jsonataQuery: 'packages.{ "depName": package }',
      },
      'The jsonata query returned no matches. Possible error, please check your query. Skipping',
    );
    expect(res).toMatchObject({
      ...config,
      deps: [
        {
          depName: 'bar',
          currentValue: '1.0.0',
          datasource: 'npm',
        },
      ],
    });
  });

  it('populates manager config and jsonata manager template fields in extract result', async () => {
    const config = {
      fileFormat: 'json',
      matchStrings: [`{"depName": "foo"}`, `{"depName": "bar"}`],
      currentValueTemplate: '1.0.0',
      datasourceTemplate: 'npm',
      // should be included present extract result as it is not valid jsonata manager template
      // adding here for testing
      autoReplaceStringTemplate: `{{{depName}}}:{{{newValue}}}`,
    };
    const res = await extractPackageFile('{}', 'unused', config);
    expect(res).toMatchObject({
      deps: [
        {
          depName: 'foo',
          currentValue: '1.0.0',
          datasource: 'npm',
        },
        {
          depName: 'bar',
          currentValue: '1.0.0',
          datasource: 'npm',
        },
      ],
      fileFormat: 'json',
      matchStrings: [`{"depName": "foo"}`, `{"depName": "bar"}`],
      currentValueTemplate: '1.0.0',
      datasourceTemplate: 'npm',
    });
  });

  it('extracts toml', async () => {
    const json = codeBlock`
        [[packages]]
        dep_name = "foo"
        package_name = "fii"
        current_value = "1.2.3"
        current_digest = "1234"
        data_source = "nuget"
        versioning = "maven"
        extract_version = "custom-extract-version"
        registry_url = "https://registry.npmjs.org"
        dep_type = "dev"

        some = true
    `;
    const config = {
      fileFormat: 'toml',
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
      ...config,
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
    });
  });
});
