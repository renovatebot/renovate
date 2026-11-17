import { constructComponentUrls } from './url.ts';

describe('modules/datasource/apk/url', () => {
  describe('constructComponentUrls', () => {
    it('constructs one URL per component', () => {
      const registryUrl =
        'https://dl-cdn.alpinelinux.org/alpine?branch=v3.19&components=main,community&arch=x86_64';

      expect(constructComponentUrls(registryUrl)).toEqual([
        'https://dl-cdn.alpinelinux.org/alpine/v3.19/main/x86_64',
        'https://dl-cdn.alpinelinux.org/alpine/v3.19/community/x86_64',
      ]);
    });

    it('ignores surrounding whitespace and empty components', () => {
      const registryUrl =
        'https://dl-cdn.alpinelinux.org/alpine?branch=edge&components=main, testing,&arch=aarch64';

      expect(constructComponentUrls(registryUrl)).toEqual([
        'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
        'https://dl-cdn.alpinelinux.org/alpine/edge/testing/aarch64',
      ]);
    });

    it('omits the component segment when components are absent', () => {
      const registryUrl = 'https://packages.wolfi.dev/os?arch=x86_64';

      expect(constructComponentUrls(registryUrl)).toEqual([
        'https://packages.wolfi.dev/os/x86_64',
      ]);
    });

    it('omits the component segment when components are empty', () => {
      const registryUrl =
        'https://packages.wolfi.dev/os?components=&arch=x86_64';

      expect(constructComponentUrls(registryUrl)).toEqual([
        'https://packages.wolfi.dev/os/x86_64',
      ]);
    });

    it('omits the branch segment when the branch is absent', () => {
      const registryUrl =
        'https://packages.cgr.dev/extras?components=main&arch=x86_64';

      expect(constructComponentUrls(registryUrl)).toEqual([
        'https://packages.cgr.dev/extras/main/x86_64',
      ]);
    });

    it('keeps unrelated path segments of the base URL', () => {
      const registryUrl =
        'https://artifactory.example.com/artifactory/alpine-remote?branch=v3.19&components=main&arch=x86_64';

      expect(constructComponentUrls(registryUrl)).toEqual([
        'https://artifactory.example.com/artifactory/alpine-remote/v3.19/main/x86_64',
      ]);
    });

    it('keeps credentials in the base URL', () => {
      const registryUrl =
        'https://user:token@mirror.example.com/alpine?branch=v3.19&components=main&arch=x86_64';

      expect(constructComponentUrls(registryUrl)).toEqual([
        'https://user:token@mirror.example.com/alpine/v3.19/main/x86_64',
      ]);
    });

    it('keeps a non-default port in the base URL', () => {
      const registryUrl =
        'https://mirror.example.com:8443/alpine?branch=v3.19&components=main&arch=x86_64';

      expect(constructComponentUrls(registryUrl)).toEqual([
        'https://mirror.example.com:8443/alpine/v3.19/main/x86_64',
      ]);
    });

    it('drops anything else in the base URL', () => {
      const registryUrl =
        'https://dl-cdn.alpinelinux.org/alpine?branch=v3.19&components=main&arch=x86_64#fragment';

      expect(constructComponentUrls(registryUrl)).toEqual([
        'https://dl-cdn.alpinelinux.org/alpine/v3.19/main/x86_64',
      ]);
    });

    it('throws when arch is missing', () => {
      const registryUrl =
        'https://dl-cdn.alpinelinux.org/alpine?branch=v3.19&components=main';

      expect(() => constructComponentUrls(registryUrl)).toThrow(
        `Missing required query parameter 'arch'`,
      );
    });

    it('throws for an unknown parameter', () => {
      const registryUrl =
        'https://dl-cdn.alpinelinux.org/alpine?branch=v3.19&components=main&arch=x86_64&token=secret';

      expect(() => constructComponentUrls(registryUrl)).toThrow(
        `Unknown query parameter 'token'`,
      );
    });

    it('throws for a misspelt parameter instead of ignoring it', () => {
      const registryUrl =
        'https://dl-cdn.alpinelinux.org/alpine?branch=v3.19&component=main&arch=x86_64';

      expect(() => constructComponentUrls(registryUrl)).toThrow(
        `Unknown query parameter 'component'`,
      );
    });

    it('throws for an arch which is not a usable path segment', () => {
      const registryUrl =
        'https://dl-cdn.alpinelinux.org/alpine?branch=v3.19&components=main&arch=../..';

      expect(() => constructComponentUrls(registryUrl)).toThrow(
        `Invalid 'arch' query parameter: '../..'`,
      );
    });

    it('throws for a branch which is not a usable path segment', () => {
      const registryUrl =
        'https://dl-cdn.alpinelinux.org/alpine?branch=../../etc&components=main&arch=x86_64';

      expect(() => constructComponentUrls(registryUrl)).toThrow(
        `Invalid 'branch' query parameter: '../../etc'`,
      );
    });

    it('throws for a component which is not a usable path segment', () => {
      const registryUrl =
        'https://dl-cdn.alpinelinux.org/alpine?branch=v3.19&components=main,../..&arch=x86_64';

      expect(() => constructComponentUrls(registryUrl)).toThrow(
        `Invalid 'components' query parameter: '../..'`,
      );
    });

    it('throws for an unparseable registry URL', () => {
      expect(() => constructComponentUrls('not-a-valid-url')).toThrow(
        'Cannot parse URL',
      );
    });
  });
});
