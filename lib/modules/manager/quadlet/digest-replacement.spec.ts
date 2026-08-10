import { codeBlock } from 'common-tags';
import { extractPackageFile } from './extract.ts';

describe('modules/manager/quadlet/digest-replacement', () => {
  it('supports digest replacement metadata for Quadlet images', () => {
    const image =
      'docker.io/library/alpine:3.23.0@sha256:51183f2cfa6320055da30872f211093f9ff1d3cf06f39a0bdb212314c5dc7375';
    const content = codeBlock`
      [Container]
      Image=${image}
    `;

    const result = extractPackageFile(content, 'alpine.container', {});

    expect(result).toEqual({
      deps: [
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest:
            'sha256:51183f2cfa6320055da30872f211093f9ff1d3cf06f39a0bdb212314c5dc7375',
          currentValue: '3.23.0',
          datasource: 'docker',
          depName: 'docker.io/library/alpine',
          depType: 'image',
          packageName: 'docker.io/library/alpine',
          replaceString: image,
        },
      ],
    });
  });
});
