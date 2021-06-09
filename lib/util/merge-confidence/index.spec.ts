import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import * as hostRules from '../host-rules';
import {
  getMergeConfidenceLevel,
  isActiveConfidenceLevel,
  satisfiesConfidenceLevel,
} from '.';

describe(getName(), () => {
  describe('isActiveConfidenceLevel()', () => {
    it('returns false if null', () => {
      expect(isActiveConfidenceLevel(null)).toBe(false);
    });

    it('returns false if low', () => {
      expect(isActiveConfidenceLevel('low')).toBe(false);
    });

    it('returns false if nonsense', () => {
      expect(isActiveConfidenceLevel('nonsense')).toBe(false);
    });

    it('returns true if valid value (high)', () => {
      expect(isActiveConfidenceLevel('high')).toBe(true);
    });
  });

  describe('satisfiesConfidenceLevel()', () => {
    it('returns false if less', () => {
      expect(satisfiesConfidenceLevel('low', 'high')).toBe(false);
    });

    it('returns true if equal', () => {
      expect(satisfiesConfidenceLevel('high', 'high')).toBe(true);
    });

    it('returns true if more', () => {
      expect(satisfiesConfidenceLevel('very high', 'high')).toBe(true);
    });
  });

  describe('getMergeConfidenceLevel()', () => {
    beforeEach(() => {
      hostRules.clear();
    });

    it('returns neutral if undefined updateType', async () => {
      expect(
        await getMergeConfidenceLevel(
          'npm',
          'renovate',
          '25.0.0',
          '25.0.0',
          undefined
        )
      ).toBe('neutral');
    });

    it('returns neutral if irrelevant updateType', async () => {
      expect(
        await getMergeConfidenceLevel(
          'npm',
          'renovate',
          '24.1.0',
          '25.0.0',
          'bump'
        )
      ).toBe('neutral');
    });

    it('returns high if pinning', async () => {
      expect(
        await getMergeConfidenceLevel(
          'npm',
          'renovate',
          '25.0.1',
          '25.0.1',
          'pin'
        )
      ).toBe('high');
    });

    it('returns neutral if no token', async () => {
      expect(
        await getMergeConfidenceLevel(
          'npm',
          'renovate',
          '24.2.0',
          '25.0.0',
          'major'
        )
      ).toBe('neutral');
    });

    it('returns valid confidence level', async () => {
      hostRules.add({ hostType: 'merge-confidence', token: 'abc123' });
      const datasource = 'npm';
      const depName = 'renovate';
      const currentVersion = '24.3.0';
      const newVersion = '25.0.0';
      httpMock
        .scope('https://badges.renovateapi.com')
        .get(
          `/packages/${datasource}/${depName}/${newVersion}/confidence.api/${currentVersion}`
        )
        .reply(200, { confidence: 'high' });
      expect(
        await getMergeConfidenceLevel(
          datasource,
          depName,
          currentVersion,
          newVersion,
          'major'
        )
      ).toBe('high');
    });

    it('returns from cachel', async () => {
      hostRules.add({ hostType: 'merge-confidence', token: 'abc123' });
      const datasource = 'npm';
      const depName = 'renovate';
      const currentVersion = '24.3.0';
      const newVersion = '25.0.0';
      expect(
        await getMergeConfidenceLevel(
          datasource,
          depName,
          currentVersion,
          newVersion,
          'major'
        )
      ).toBe('high');
    });

    it('returns neutral if invalid confidence level', async () => {
      hostRules.add({ hostType: 'merge-confidence', token: 'abc123' });
      const datasource = 'npm';
      const depName = 'renovate';
      const currentVersion = '25.0.0';
      const newVersion = '25.1.0';
      httpMock
        .scope('https://badges.renovateapi.com')
        .get(
          `/packages/${datasource}/${depName}/${newVersion}/confidence.api/${currentVersion}`
        )
        .reply(200, { nope: 'nope' });
      expect(
        await getMergeConfidenceLevel(
          datasource,
          depName,
          currentVersion,
          newVersion,
          'minor'
        )
      ).toBe('neutral');
    });

    it('returns neutral if exception from API', async () => {
      hostRules.add({ hostType: 'merge-confidence', token: 'abc123' });
      const datasource = 'npm';
      const depName = 'renovate';
      const currentVersion = '25.0.0';
      const newVersion = '25.4.0';
      httpMock
        .scope('https://badges.renovateapi.com')
        .get(
          `/packages/${datasource}/${depName}/${newVersion}/confidence.api/${currentVersion}`
        )
        .reply(403);
      expect(
        await getMergeConfidenceLevel(
          datasource,
          depName,
          currentVersion,
          newVersion,
          'minor'
        )
      ).toBe('neutral');
    });
  });
});
