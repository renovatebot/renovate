import { readFileSync } from 'fs';
import * as datasourceDocker from '../../datasource/docker';
import * as datasourceGitTags from '../../datasource/git-tags';
import { extractBase, extractImage, parseKustomize } from './common';

const kustomizeGitSSHBase = readFileSync(
  'lib/manager/kustomize/__fixtures__/gitSshBase.yaml',
  'utf8'
);

describe('manager/kustomize/common', () => {
  it('should successfully parse a valid kustomize file', () => {
    const file = parseKustomize(kustomizeGitSSHBase);
    expect(file).not.toBeNull();
  });
  it('return null on an invalid file', () => {
    const file = parseKustomize('');
    expect(file).toBeNull();
  });
});

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
        currentValue: version,
        datasource: datasourceGitTags.id,
        depName: base,
        depType: datasourceGitTags.id,
        lookupName: base,
        source: base,
      };

      const pkg = extractBase(`${base}?ref=${version}`);
      expect(pkg).toEqual(sample);
    });
    it('should extract out the version and source of a git base', () => {
      const base = 'git@github.com:user/repo.git';
      const version = 'v1.0.0';
      const sample = {
        currentValue: version,
        datasource: datasourceGitTags.id,
        depName: base,
        depType: datasourceGitTags.id,
        lookupName: base,
        source: base,
      };

      const pkg = extractBase(`${base}?ref=${version}`);
      expect(pkg).toEqual(sample);
    });
    it('should extract out the version and source of a git base with subdir', () => {
      const base = 'git@github.com:user/repo.git';
      const version = 'v1.0.0';
      const sample = {
        currentValue: version,
        datasource: datasourceGitTags.id,
        depName: `${base}//subdir`,
        depType: datasourceGitTags.id,
        lookupName: base,
        source: base,
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
        currentValue: 'v1.0.0',
        datasource: datasourceDocker.id,
        depName: 'node',
        depType: datasourceDocker.id,
        lookupName: 'node',
        source: 'node',
      };
      const pkg = extractImage({
        name: sample.lookupName,
        newTag: sample.currentValue,
      });
      expect(pkg).toEqual(sample);
    });
    it('should correctly extract an image in a repo', () => {
      const sample = {
        currentValue: 'v1.0.0',
        datasource: datasourceDocker.id,
        depName: 'test/node',
        depType: datasourceDocker.id,
        lookupName: 'test/node',
        source: 'test/node',
      };
      const pkg = extractImage({
        name: sample.lookupName,
        newTag: sample.currentValue,
      });
      expect(pkg).toEqual(sample);
    });
    it('should correctly extract from a different registry', () => {
      const sample = {
        currentValue: 'v1.0.0',
        datasource: datasourceDocker.id,
        depName: 'quay.io/repo/image',
        depType: datasourceDocker.id,
        lookupName: 'quay.io/repo/image',
        source: 'quay.io/repo/image',
      };
      const pkg = extractImage({
        name: sample.lookupName,
        newTag: sample.currentValue,
      });
      expect(pkg).toEqual(sample);
    });
    it('should correctly extract from a different port', () => {
      const sample = {
        currentValue: 'v1.0.0',
        datasource: datasourceDocker.id,
        depName: 'localhost:5000/repo/image',
        depType: datasourceDocker.id,
        lookupName: 'localhost:5000/repo/image',
        source: 'localhost:5000/repo/image',
      };
      const pkg = extractImage({
        name: sample.lookupName,
        newTag: sample.currentValue,
      });
      expect(pkg).toEqual(sample);
    });
    it('should correctly extract from a multi-depth registry', () => {
      const sample = {
        currentValue: 'v1.0.0',
        datasource: datasourceDocker.id,
        depName: 'localhost:5000/repo/image/service',
        depType: datasourceDocker.id,
        lookupName: 'localhost:5000/repo/image/service',
        source: 'localhost:5000/repo/image/service',
      };
      const pkg = extractImage({
        name: sample.lookupName,
        newTag: sample.currentValue,
      });
      expect(pkg).toEqual(sample);
    });
  });
});
