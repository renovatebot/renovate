import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractPackageFile } from '.';

const dockerfileContent = readFileSync(
  resolve(__dirname, `./__fixtures__/Dockerfile`),
  'utf8'
);
describe('manager/custom/extract', () => {
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
    expect(res.deps.find(dep => dep.depName === 'yarn').versioning).toEqual(
      'semver'
    );
    expect(res.deps.find(dep => dep.depName === 'gradle').versioning).toEqual(
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
});
