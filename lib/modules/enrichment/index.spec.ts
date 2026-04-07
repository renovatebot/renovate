import type { RenovateConfig } from '../../config/types.ts';
import api from './api.ts';
import {
  getEnrichments,
  initEnrichments,
  initRepoEnrichments,
  runRepositoryEnrichments,
  runUpdateEnrichments,
} from './index.ts';
import type { EnrichmentApi, EnrichmentResult } from './types.ts';

function createMockEnrichment(
  overrides: Partial<EnrichmentApi> = {},
): EnrichmentApi {
  return {
    id: 'test-enrichment',
    capabilities: {},
    isEnabled: () => true,
    ...overrides,
  };
}

describe('modules/enrichment/index', () => {
  beforeEach(() => {
    api.clear();
  });

  describe('getEnrichments()', () => {
    it('returns the enrichment registry', () => {
      const enrichment = createMockEnrichment({ id: 'test' });
      api.set('test', enrichment);
      expect(getEnrichments().get('test')).toBe(enrichment);
    });
  });

  describe('initEnrichments()', () => {
    it('calls init() on enabled enrichments', async () => {
      const initFn = vi.fn();
      api.set('a', createMockEnrichment({ id: 'a', init: initFn }));
      await initEnrichments({} as RenovateConfig);
      expect(initFn).toHaveBeenCalledOnce();
    });

    it('skips disabled enrichments', async () => {
      const initFn = vi.fn();
      api.set(
        'a',
        createMockEnrichment({
          id: 'a',
          init: initFn,
          isEnabled: () => false,
        }),
      );
      await initEnrichments({} as RenovateConfig);
      expect(initFn).not.toHaveBeenCalled();
    });

    it('skips enrichments without init()', async () => {
      api.set('a', createMockEnrichment({ id: 'a' }));
      await expect(
        initEnrichments({} as RenovateConfig),
      ).resolves.toBeUndefined();
    });
  });

  describe('initRepoEnrichments()', () => {
    it('calls initRepo() on enabled enrichments', async () => {
      const initRepoFn = vi.fn();
      api.set('a', createMockEnrichment({ id: 'a', initRepo: initRepoFn }));
      await initRepoEnrichments({} as RenovateConfig);
      expect(initRepoFn).toHaveBeenCalledOnce();
    });

    it('skips disabled enrichments', async () => {
      const initRepoFn = vi.fn();
      api.set(
        'a',
        createMockEnrichment({
          id: 'a',
          initRepo: initRepoFn,
          isEnabled: () => false,
        }),
      );
      await initRepoEnrichments({} as RenovateConfig);
      expect(initRepoFn).not.toHaveBeenCalled();
    });
  });

  describe('runRepositoryEnrichments()', () => {
    it('appends packageRules from enrichments to config', async () => {
      const result: EnrichmentResult = {
        packageRules: [{ matchPackageNames: ['lodash'] }],
      };
      api.set(
        'a',
        createMockEnrichment({
          id: 'a',
          enrichRepository: vi.fn().mockResolvedValue(result),
        }),
      );
      const config: RenovateConfig = {};
      await runRepositoryEnrichments(config, {});
      expect(config.packageRules).toEqual([{ matchPackageNames: ['lodash'] }]);
    });

    it('appends packageRules from multiple enrichments', async () => {
      api.set(
        'a',
        createMockEnrichment({
          id: 'a',
          enrichRepository: vi.fn().mockResolvedValue({
            packageRules: [{ matchPackageNames: ['a'] }],
          }),
        }),
      );
      api.set(
        'b',
        createMockEnrichment({
          id: 'b',
          enrichRepository: vi.fn().mockResolvedValue({
            packageRules: [{ matchPackageNames: ['b'] }],
          }),
        }),
      );
      const config: RenovateConfig = {};
      await runRepositoryEnrichments(config, {});
      expect(config.packageRules).toEqual([
        { matchPackageNames: ['a'] },
        { matchPackageNames: ['b'] },
      ]);
    });

    it('skips enrichments without enrichRepository()', async () => {
      api.set('a', createMockEnrichment({ id: 'a' }));
      const config: RenovateConfig = {};
      await runRepositoryEnrichments(config, {});
      expect(config.packageRules).toBeUndefined();
    });

    it('does not modify config when result has no packageRules', async () => {
      api.set(
        'a',
        createMockEnrichment({
          id: 'a',
          enrichRepository: vi.fn().mockResolvedValue({}),
        }),
      );
      const config: RenovateConfig = {};
      await runRepositoryEnrichments(config, {});
      expect(config.packageRules).toBeUndefined();
    });
  });

  describe('runUpdateEnrichments()', () => {
    const context = {
      datasource: 'npm',
      packageName: 'lodash',
      currentVersion: '4.17.20',
      newVersion: '4.17.21',
      updateType: 'patch',
    };

    it('returns merged metadata from enrichments', async () => {
      api.set(
        'a',
        createMockEnrichment({
          id: 'a',
          enrichUpdate: vi
            .fn()
            .mockResolvedValue({ metadata: { confidence: 'high' } }),
        }),
      );
      const result = await runUpdateEnrichments(context, {} as RenovateConfig);
      expect(result.metadata).toEqual({ confidence: 'high' });
    });

    it('merges metadata from multiple enrichments', async () => {
      api.set(
        'a',
        createMockEnrichment({
          id: 'a',
          enrichUpdate: vi
            .fn()
            .mockResolvedValue({ metadata: { confidence: 'high' } }),
        }),
      );
      api.set(
        'b',
        createMockEnrichment({
          id: 'b',
          enrichUpdate: vi.fn().mockResolvedValue({ metadata: { score: 8 } }),
        }),
      );
      const result = await runUpdateEnrichments(context, {} as RenovateConfig);
      expect(result.metadata).toEqual({ confidence: 'high', score: 8 });
    });

    it('skips null results', async () => {
      api.set(
        'a',
        createMockEnrichment({
          id: 'a',
          enrichUpdate: vi.fn().mockResolvedValue(null),
        }),
      );
      const result = await runUpdateEnrichments(context, {} as RenovateConfig);
      expect(result).toEqual({});
    });

    it('collects prBodyNotes from multiple enrichments', async () => {
      api.set(
        'a',
        createMockEnrichment({
          id: 'a',
          enrichUpdate: vi
            .fn()
            .mockResolvedValue({ prBodyNotes: ['note from a'] }),
        }),
      );
      api.set(
        'b',
        createMockEnrichment({
          id: 'b',
          enrichUpdate: vi
            .fn()
            .mockResolvedValue({ prBodyNotes: ['note from b'] }),
        }),
      );
      const result = await runUpdateEnrichments(context, {} as RenovateConfig);
      expect(result.prBodyNotes).toEqual(['note from a', 'note from b']);
    });

    it('keeps first skipReason only', async () => {
      api.set(
        'a',
        createMockEnrichment({
          id: 'a',
          enrichUpdate: vi
            .fn()
            .mockResolvedValue({ skipReason: 'disabled' as const }),
        }),
      );
      api.set(
        'b',
        createMockEnrichment({
          id: 'b',
          enrichUpdate: vi
            .fn()
            .mockResolvedValue({ skipReason: 'ignored' as const }),
        }),
      );
      const result = await runUpdateEnrichments(context, {} as RenovateConfig);
      expect(result.skipReason).toBe('disabled');
    });

    it('uses last statusCheck', async () => {
      api.set(
        'a',
        createMockEnrichment({
          id: 'a',
          enrichUpdate: vi.fn().mockResolvedValue({
            statusCheck: {
              context: 'check-a',
              status: 'green' as const,
              description: 'a passed',
            },
          }),
        }),
      );
      api.set(
        'b',
        createMockEnrichment({
          id: 'b',
          enrichUpdate: vi.fn().mockResolvedValue({
            statusCheck: {
              context: 'check-b',
              status: 'yellow' as const,
              description: 'b pending',
            },
          }),
        }),
      );
      const result = await runUpdateEnrichments(context, {} as RenovateConfig);
      expect(result.statusCheck?.context).toBe('check-b');
    });

    it('returns empty result when no enrichments are registered', async () => {
      const result = await runUpdateEnrichments(context, {} as RenovateConfig);
      expect(result).toEqual({});
    });
  });
});
