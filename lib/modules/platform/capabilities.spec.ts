import {
  setPlatformCapabilities,
  supportsGit,
  supportsHtmlComments,
} from './capabilities.ts';

describe('modules/platform/capabilities', () => {
  it('falls back to the defaults when the platform declares nothing', () => {
    setPlatformCapabilities(undefined);

    expect(supportsGit()).toBeTrue();
    expect(supportsHtmlComments()).toBeFalse();
  });

  it('falls back to the defaults for flags the platform omits', () => {
    setPlatformCapabilities({ htmlComments: true });

    expect(supportsGit()).toBeTrue();
    expect(supportsHtmlComments()).toBeTrue();
  });

  it('uses the declared flags', () => {
    setPlatformCapabilities({ git: false, htmlComments: false });

    expect(supportsGit()).toBeFalse();
    expect(supportsHtmlComments()).toBeFalse();
  });
});
