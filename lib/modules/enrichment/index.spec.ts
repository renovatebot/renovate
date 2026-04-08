import { logger } from '~test/util.ts';
import type { RenovateConfig } from '../../config/types.ts';
import api from './api.ts';
import {
  getEnrichments,
  initEnrichments,
  initRepoEnrichments,
  runRepositoryEnrichments,
  runUpdateEnrichments,
} from './index.ts';
import type {
  EnrichmentApi,
  EnrichmentResult,
  EnrichmentUpdateContext,
} from './types.ts';

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
    it('calls init() on all enrichments, regardless of whether they are enabled or disabled', async () => {
      api.set('a', createMockEnrichment({ id: 'a' }));
      const disabledInitFn = vi.fn();
      api.set(
        'b',
        createMockEnrichment({
          id: 'b',
          init: disabledInitFn,
          isEnabled: () => false,
        }),
      );

      await initEnrichments({} as RenovateConfig);
      expect(disabledInitFn).toHaveBeenCalledOnce();
    });

    it('skips enrichments without init()', async () => {
      api.set('a', createMockEnrichment({ id: 'a' }));
      await expect(
        initEnrichments({} as RenovateConfig),
      ).resolves.toBeUndefined();
    });
  });

  describe('initRepoEnrichments()', () => {
    it('calls initRepo() on all enrichments, regardless of whether they are enabled or disabled', async () => {
      api.set('a', createMockEnrichment({ id: 'a' }));
      const disabledInitFn = vi.fn();
      api.set(
        'b',
        createMockEnrichment({
          id: 'b',
          initRepo: disabledInitFn,
          isEnabled: () => false,
        }),
      );

      await initRepoEnrichments({} as RenovateConfig);
      expect(disabledInitFn).toHaveBeenCalledOnce();
    });

    it('skips enrichments without initRepo()', async () => {
      api.set('a', createMockEnrichment({ id: 'a' }));
      await expect(
        initRepoEnrichments({} as RenovateConfig),
      ).resolves.toBeUndefined();
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

    it('skips disabled enrichments', async () => {
      api.set(
        'a',
        createMockEnrichment({
          id: 'a',
          enrichRepository: vi.fn().mockResolvedValue({}),
          isEnabled: () => false,
        }),
      );
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
    const context: EnrichmentUpdateContext = {
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
            .mockResolvedValue({ mergeConfidenceLevel: 'high' }),
        }),
      );
      const result = await runUpdateEnrichments(context, {} as RenovateConfig);
      expect(result).toEqual({ mergeConfidenceLevel: 'high' });
    });

    it('merges metadata from multiple enrichments', async () => {
      api.set(
        'a',
        createMockEnrichment({
          id: 'a',
          enrichUpdate: vi.fn().mockResolvedValue({
            mergeConfidenceLevel: 'high',
            metadata: { score: 8 },
          }),
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
      expect(result).toEqual({
        mergeConfidenceLevel: 'high',
        metadata: { score: 8 },
      });
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

    it('skips disabled enrichments results', async () => {
      api.set(
        'a',
        createMockEnrichment({
          id: 'a',
          enrichUpdate: vi.fn().mockResolvedValue(null),
          isEnabled: () => false,
        }),
      );
      const result = await runUpdateEnrichments(context, {} as RenovateConfig);
      expect(result).toEqual({});
    });

    it('combines prBodyNotes from multiple enrichments', async () => {
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

    describe('skipReason', () => {
      it('is added when set', async () => {
        api.set(
          'a',
          createMockEnrichment({
            id: 'a',
            enrichUpdate: vi
              .fn()
              .mockResolvedValue({ skipReason: 'disabled' as const }),
          }),
        );

        const result = await runUpdateEnrichments(
          context,
          {} as RenovateConfig,
        );
        expect(result.skipReason).toBe('disabled');
      });

      it('includes skipReferences if set alongside a skipReason', async () => {
        api.set(
          'a',
          createMockEnrichment({
            id: 'a',
            enrichUpdate: vi.fn().mockResolvedValue({
              skipReason: 'disabled' as const,
              skipReferences: [
                'https://docs.example.com/deprecation',
                'https://docs.example.com/removal',
              ],
            }),
          }),
        );

        const result = await runUpdateEnrichments(
          context,
          {} as RenovateConfig,
        );
        expect(result.skipReferences).toEqual([
          'https://docs.example.com/deprecation',
          'https://docs.example.com/removal',
        ]);
      });

      it('ignores skipReferences if no skipReason is set', async () => {
        api.set(
          'a',
          createMockEnrichment({
            id: 'a',
            enrichUpdate: vi.fn().mockResolvedValue({
              skipReferences: [
                'https://docs.example.com/deprecation',
                'https://docs.example.com/removal',
              ],
            }),
          }),
        );

        const result = await runUpdateEnrichments(
          context,
          {} as RenovateConfig,
        );
        expect(result.skipReferences).toBeUndefined();
      });

      describe('when multiple skipReasons', () => {
        it('keeps last skipReason', async () => {
          api.set(
            'a',
            createMockEnrichment({
              id: 'a',
              enrichUpdate: vi
                .fn()
                .mockResolvedValue({ skipReason: 'ignored' as const }),
            }),
          );
          api.set(
            'b',
            createMockEnrichment({
              id: 'b',
              enrichUpdate: vi
                .fn()
                .mockResolvedValue({ skipReason: 'disabled' as const }),
            }),
          );
          const result = await runUpdateEnrichments(
            context,
            {} as RenovateConfig,
          );
          expect(result.skipReason).toBe('disabled');
        });

        it('debug logs when overwriting', async () => {
          api.set(
            'a',
            createMockEnrichment({
              id: 'a',
              enrichUpdate: vi
                .fn()
                .mockResolvedValue({ skipReason: 'ignored' as const }),
            }),
          );
          api.set(
            'b',
            createMockEnrichment({
              id: 'b',
              enrichUpdate: vi
                .fn()
                .mockResolvedValue({ skipReason: 'disabled' as const }),
            }),
          );
          await runUpdateEnrichments(context, {} as RenovateConfig);

          expect(logger.logger.debug).toHaveBeenCalledWith(
            {
              moduleId: 'b',
              source: {
                skipReason: 'disabled',
              },
              target: {
                skipReason: 'ignored',
                skipReferences: undefined,
              },
            },
            "Overwriting previously set `skipReason` from module 'b'",
          );
        });
      });
    });

    it('merges multiple statusChecks', async () => {
      api.set(
        'a',
        createMockEnrichment({
          id: 'a',
          enrichUpdate: vi.fn().mockResolvedValue({
            statusChecks: [
              {
                context: 'check-a',
                state: 'green' as const,
                description: 'a passed',
              },
            ],
          }),
        }),
      );
      api.set(
        'b',
        createMockEnrichment({
          id: 'b',
          enrichUpdate: vi.fn().mockResolvedValue({
            statusChecks: [
              {
                context: 'check-b',
                state: 'yellow' as const,
                description: 'b pending',
              },
            ],
          }),
        }),
      );
      const result = await runUpdateEnrichments(context, {} as RenovateConfig);
      expect(result.statusChecks).toBeDefined();
      expect(result.statusChecks!).toHaveLength(1);
      expect(result.statusChecks![0].context).toEqual('check-b');
    });

    it('adds a trace log when merging `EnrichmentResult`s', async () => {
      api.set(
        'a',
        createMockEnrichment({
          id: 'a',
          enrichUpdate: vi.fn().mockResolvedValue({
            statusChecks: [
              {
                context: 'check-a',
                state: 'green' as const,
                description: 'a passed',
              },
            ],
          }),
        }),
      );
      api.set(
        'b',
        createMockEnrichment({
          id: 'b',
          enrichUpdate: vi.fn().mockResolvedValue({
            statusChecks: [
              {
                context: 'check-b',
                state: 'yellow' as const,
                description: 'b pending',
              },
            ],
          }),
        }),
      );

      await runUpdateEnrichments(context, {} as RenovateConfig);

      expect(logger.logger.trace).toHaveBeenNthCalledWith(
        1,
        {
          moduleId: 'a',
          source: {
            statusChecks: [
              {
                context: 'check-a',
                state: 'green',
                description: 'a passed',
              },
            ],
          },
          target: {},
        },
        "Merging EnrichmentResult for module 'a'",
      );
      expect(logger.logger.trace).toHaveBeenNthCalledWith(
        2,
        {
          moduleId: 'b',
          source: {
            statusChecks: [
              {
                context: 'check-b',
                state: 'yellow',
                description: 'b pending',
              },
            ],
          },
          target: {
            statusChecks: [
              {
                context: 'check-a',
                state: 'green',
                description: 'a passed',
              },
            ],
          },
        },
        "Merging EnrichmentResult for module 'b'",
      );
    });

    it('returns empty result when no enrichments are registered', async () => {
      const result = await runUpdateEnrichments(context, {} as RenovateConfig);
      expect(result).toEqual({});
    });
  });
});
