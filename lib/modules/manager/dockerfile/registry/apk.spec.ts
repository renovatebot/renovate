import type { PackageDependency } from '../../types.ts';
import { detectApkRegistryUrls } from './apk.ts';

interface UndetectedCase {
  name: string;
  image: PackageDependency;
}

interface DetectedCase extends UndetectedCase {
  expected: string[];
}

describe('modules/manager/dockerfile/registry/apk', () => {
  describe('detectApkRegistryUrls()', () => {
    it.each<UndetectedCase>([
      {
        name: 'a `FROM` Renovate could not parse',
        image: { skipReason: 'contains-variable' },
      },
      {
        name: 'an image built on Alpine which names no release',
        image: { depName: 'vault', currentValue: '1.13.3' },
      },
      {
        name: 'a tag naming Alpine but not which release',
        image: { depName: 'node', currentValue: '22-alpine' },
      },
      {
        name: 'a release which is not a branch',
        image: { depName: 'alpine', currentValue: '3.22.0_rc1' },
      },
      {
        name: 'an Alpine tag suffix with no minor version',
        image: { depName: 'node', currentValue: '22-alpine3' },
      },
      {
        name: 'an untagged image which is not Alpine',
        image: { depName: 'node' },
      },
    ])('returns nothing for $name', ({ image }) => {
      expect(detectApkRegistryUrls(image)).toBeUndefined();
    });

    it.each<DetectedCase>([
      {
        name: 'the alpine image',
        image: { depName: 'alpine', currentValue: '3.21' },
        expected: [
          'https://dl-cdn.alpinelinux.org/alpine?branch=v3.21&components=main,community&arch=x86_64',
        ],
      },
      {
        name: 'an alpine point release',
        image: { depName: 'alpine', currentValue: '3.21.4' },
        expected: [
          'https://dl-cdn.alpinelinux.org/alpine?branch=v3.21&components=main,community&arch=x86_64',
        ],
      },
      {
        name: 'a registry-qualified alpine image',
        image: {
          depName: 'public.ecr.aws/docker/library/alpine',
          currentValue: '3.19',
        },
        expected: [
          'https://dl-cdn.alpinelinux.org/alpine?branch=v3.19&components=main,community&arch=x86_64',
        ],
      },
      {
        name: 'an untagged alpine image',
        image: { depName: 'alpine' },
        expected: [
          'https://dl-cdn.alpinelinux.org/alpine?branch=latest-stable&components=main,community&arch=x86_64',
        ],
      },
      {
        name: 'the alpine latest tag',
        image: { depName: 'alpine', currentValue: 'latest' },
        expected: [
          'https://dl-cdn.alpinelinux.org/alpine?branch=latest-stable&components=main,community&arch=x86_64',
        ],
      },
      {
        name: 'the alpine edge tag',
        image: { depName: 'alpine', currentValue: 'edge' },
        expected: [
          'https://dl-cdn.alpinelinux.org/alpine?branch=edge&components=main,community&arch=x86_64',
        ],
      },
      {
        name: 'the release another image tags itself with',
        image: { depName: 'node', currentValue: '22-alpine3.21' },
        expected: [
          'https://dl-cdn.alpinelinux.org/alpine?branch=v3.21&components=main,community&arch=x86_64',
        ],
      },
      {
        name: 'the point release another image tags itself with',
        image: { depName: 'node', currentValue: '22-alpine3.21.4' },
        expected: [
          'https://dl-cdn.alpinelinux.org/alpine?branch=v3.21&components=main,community&arch=x86_64',
        ],
      },
      {
        name: 'the Wolfi base image',
        image: {
          depName: 'cgr.dev/chainguard/wolfi-base',
          currentValue: 'latest',
        },
        expected: ['https://packages.wolfi.dev/os?arch=x86_64'],
      },
      {
        name: 'any Chainguard image',
        image: { depName: 'cgr.dev/chainguard/node' },
        expected: ['https://packages.wolfi.dev/os?arch=x86_64'],
      },
      {
        name: 'a mirrored Wolfi base image',
        image: { depName: 'my-mirror.io/wolfi-base' },
        expected: ['https://packages.wolfi.dev/os?arch=x86_64'],
      },
    ])('detects $name', ({ image, expected }) => {
      expect(detectApkRegistryUrls(image)).toEqual(expected);
    });
  });
});
