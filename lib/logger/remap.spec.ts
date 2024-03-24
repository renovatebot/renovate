import {
  getRemappedLevel,
  resetGlobalLogLevelRemaps,
  resetRepositoryLogLevelRemaps,
  setGlobalLogLevelRemaps,
  setRepositoryLogLevelRemaps,
} from './remap';

describe('logger/remap', () => {
  afterEach(() => {
    resetRepositoryLogLevelRemaps();
    resetGlobalLogLevelRemaps();
  });

  it('returns null if no remaps are set', () => {
    setGlobalLogLevelRemaps(undefined);
    setRepositoryLogLevelRemaps(undefined);

    const res = getRemappedLevel('foo');

    expect(res).toBeNull();
  });

  it('performs global remaps', () => {
    setGlobalLogLevelRemaps([{ matchMessage: '*foo*', newLogLevel: 'error' }]);
    setRepositoryLogLevelRemaps(undefined);

    const res = getRemappedLevel('foo');

    expect(res).toBe('error');
  });

  it('performs repository-level remaps', () => {
    setGlobalLogLevelRemaps(undefined);
    setRepositoryLogLevelRemaps([
      { matchMessage: '*bar*', newLogLevel: 'error' },
    ]);

    const res = getRemappedLevel('bar');

    expect(res).toBe('error');
  });

  it('prioritizes repository-level remaps over global remaps', () => {
    setGlobalLogLevelRemaps([{ matchMessage: '*foo*', newLogLevel: 'error' }]);
    setRepositoryLogLevelRemaps([
      { matchMessage: '*bar*', newLogLevel: 'warn' },
    ]);

    const res = getRemappedLevel('foobar');

    expect(res).toBe('warn');
  });

  it('supports regex patterns', () => {
    setGlobalLogLevelRemaps([{ matchMessage: '/foo/', newLogLevel: 'error' }]);
    setRepositoryLogLevelRemaps(undefined);

    const res = getRemappedLevel('foo');

    expect(res).toBe('error');
  });

  it('does not match against invalid regex patterns', () => {
    setGlobalLogLevelRemaps([{ matchMessage: '/(/', newLogLevel: 'error' }]);
    setRepositoryLogLevelRemaps(undefined);

    const res = getRemappedLevel('()');

    expect(res).toBeNull();
  });
});
