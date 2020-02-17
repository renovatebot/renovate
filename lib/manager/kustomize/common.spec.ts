import {
  DATASOURCE_GIT_TAGS,
  DATASOURCE_DOCKER,
} from '../../constants/data-binary-source';
import { extractBase, extractImage } from './common';

describe('manager/kustomize/common', () => {
  describe('extractBase', () => {
    it('should return null for a local base ', () => {
      const res = extractBase('./service-1');
      expect(res).toBeNull();
    });
    it('should extract out the version and source of an http base', () => {
      const base = 'https://github.com/user/test-repo.git';
      const version = 'v1.0.0';
      const sample = {
        depName: base,
        datasource: DATASOURCE_GIT_TAGS,
        lookupName: base,
        source: base,
        currentValue: version,
      };

      const pkg = extractBase(`${base}?ref=${version}`);
      expect(pkg).toEqual(sample);
    });
    it('should extract out the version and source of a git base', () => {
      const base = 'git@github.com:user/repo.git';
      const version = 'v1.0.0';
      const sample = {
        depName: base,
        source: base,
        datasource: DATASOURCE_GIT_TAGS,
        lookupName: base,
        currentValue: version,
      };

      const pkg = extractBase(`${base}?ref=${version}`);
      expect(pkg).toEqual(sample);
    });
    it('should extract out the version and source of a git base with subdir', () => {
      const base = 'git@github.com:user/repo.git';
      const version = 'v1.0.0';
      const sample = {
        depName: `${base}//subdir`,
        source: base,
        datasource: DATASOURCE_GIT_TAGS,
        lookupName: base,
        currentValue: version,
      };

      const pkg = extractBase(`${sample.depName}?ref=${version}`);
      expect(pkg).toEqual(sample);
    });
  });
});

describe('manager/kustomize/common', () => {
  describe('image extraction', () => {
    it('should return null on a null input', () => {
      const pkg = extractImage({
        name: null,
        newTag: null,
      });
      expect(pkg).toEqual(null);
    });
    it('should correctly extract a default image', () => {
      const sample = {
        depName: 'node',
        source: 'node',
        datasource: DATASOURCE_DOCKER,
        lookupName: 'node',
        currentValue: 'v1.0.0',
      };
      const pkg = extractImage({
        name: sample.lookupName,
        newTag: sample.currentValue,
      });
      expect(pkg).toEqual(sample);
    });
    it('should correctly extract an image in a repo', () => {
      const sample = {
        depName: 'test/node',
        source: 'test/node',
        datasource: DATASOURCE_DOCKER,
        lookupName: 'test/node',
        currentValue: 'v1.0.0',
      };
      const pkg = extractImage({
        name: sample.lookupName,
        newTag: sample.currentValue,
      });
      expect(pkg).toEqual(sample);
    });
    it('should correctly extract from a different registry', () => {
      const sample = {
        depName: 'quay.io/repo/image',
        source: 'quay.io/repo/image',
        datasource: DATASOURCE_DOCKER,
        lookupName: 'quay.io/repo/image',
        currentValue: 'v1.0.0',
      };
      const pkg = extractImage({
        name: sample.lookupName,
        newTag: sample.currentValue,
      });
      expect(pkg).toEqual(sample);
    });
    it('should correctly extract from a different port', () => {
      const sample = {
        depName: 'localhost:5000/repo/image',
        source: 'localhost:5000/repo/image',
        datasource: DATASOURCE_DOCKER,
        lookupName: 'localhost:5000/repo/image',
        currentValue: 'v1.0.0',
      };
      const pkg = extractImage({
        name: sample.lookupName,
        newTag: sample.currentValue,
      });
      expect(pkg).toEqual(sample);
    });
    it('should correctly extract from a multi-depth registry', () => {
      const sample = {
        depName: 'localhost:5000/repo/image/service',
        source: 'localhost:5000/repo/image/service',
        datasource: DATASOURCE_DOCKER,
        lookupName: 'localhost:5000/repo/image/service',
        currentValue: 'v1.0.0',
      };
      const pkg = extractImage({
        name: sample.lookupName,
        newTag: sample.currentValue,
      });
      expect(pkg).toEqual(sample);
    });
  });
});
