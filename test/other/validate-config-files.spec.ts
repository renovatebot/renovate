describe('other/validate-config-files', () => {
  it('tsdown entry points', async () => {
    const { default: tsdownConfig } = await import('../../tsdown.config.mts');
    expect(tsdownConfig).toBeDefined();
    expect(tsdownConfig.entry).toEqual(
      [...new Set(tsdownConfig.entry as string[])].sort(),
    );
  });
});
