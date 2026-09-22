describe('modules/manager/pre-commit/index', () => {
  async function loadDefaultConfig(): Promise<
    (typeof import('./index.ts'))['defaultConfig']
  > {
    vi.resetModules();
    const module = await import('./index.ts');
    return module.defaultConfig;
  }

  it('warns about the unsupported manager by default', async () => {
    const { prBodyNotes } = await loadDefaultConfig();
    expect(prBodyNotes).toHaveLength(1);
    expect(prBodyNotes[0]).toContain('not supported by the `pre-commit`');
  });

  it('suppresses the warning when the env var is set', async () => {
    vi.stubEnv('RENOVATE_X_SUPPRESS_PRE_COMMIT_WARNING', 'true');
    const { prBodyNotes } = await loadDefaultConfig();
    expect(prBodyNotes).toBeEmpty();
  });
});
