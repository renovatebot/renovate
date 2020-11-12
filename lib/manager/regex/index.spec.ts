import { readFileSync } from 'fs';
import { resolve } from 'upath';
import { getName } from '../../../test/util';
import { defaultConfig, extractPackageFile } from '.';

const dockerfileContent = readFileSync(
  resolve(__dirname, `./__fixtures__/Dockerfile`),
  'utf8'
);
describe(getName(__filename), () => {
  it('has default config', () => {
    expect(defaultConfig).toEqual({
      pinDigests: false,
    });
  });
  it('extracts multiple dependencies', async () => {
    const config = {
      matchStrings: [
        'ENV .*?_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>.*?)(\\&versioning=(?<versioning>.*?))?\\s',
      ],
      versioningTemplate:
        '{{#if versioning}}{{versioning}}{{else}}semver{{/if}}',
    };
    const res = await extractPackageFile(
      dockerfileContent,
      'Dockerfile',
      config
    );
    expect(res).toMatchSnapshot();
    expect(res.deps).toHaveLength(8);
    expect(res.deps.find((dep) => dep.depName === 'yarn').versioning).toEqual(
      'semver'
    );
    expect(res.deps.find((dep) => dep.depName === 'gradle').versioning).toEqual(
      'maven'
    );
  });
  it('returns null if no dependencies found', async () => {
    const config = {
      matchStrings: [
        'ENV .*?_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>.*?)(\\&versioning=(?<versioning>.*?))?\\s',
      ],
      versioningTemplate:
        '{{#if versioning}}{{versioning}}{{else}}semver{{/if}}',
    };
    const res = await extractPackageFile('', 'Dockerfile', config);
    expect(res).toBeNull();
  });
  it('returns null if invalid template', async () => {
    const config = {
      matchStrings: [
        'ENV .*?_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>.*?)(\\&versioning=(?<versioning>.*?))?\\s',
      ],
      versioningTemplate: '{{#if versioning}}{{versioning}}{{else}}semver',
    };
    const res = await extractPackageFile(
      dockerfileContent,
      'Dockerfile',
      config
    );
    expect(res).toBeNull();
  });
});
