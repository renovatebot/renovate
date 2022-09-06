import { Fixtures } from '../../../../test/fixtures';
import type { PackageDependency } from '../types';
import { extractVariables, getDep } from './extract';
import { extractPackageFile } from '.';

const d1 = Fixtures.get('1.Dockerfile');
const d2 = Fixtures.get('2.Dockerfile');
const d3 = Fixtures.get('3.Dockerfile');
const d4 = Fixtures.get('4.Dockerfile');

describe('modules/manager/dockerfile/extract', () => {
  describe('extractPackageFile()', () => {
    it('handles no FROM', () => {
      const res = extractPackageFile('no from!', '', {});
      expect(res).toBeNull();
    });

    it('handles naked dep', () => {
      const res = extractPackageFile('FROM node\n', '', {})?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'node',
          depType: 'final',
          replaceString: 'node',
        },
      ]);
    });

    it('is case insensitive', () => {
      const res = extractPackageFile('From node\n', '', {})?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'node',
          depType: 'final',
          replaceString: 'node',
        },
      ]);
    });

    it('handles tag', () => {
      const res = extractPackageFile('FROM node:8.9.0-alpine\n', '', {})?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '8.9.0-alpine',
          datasource: 'docker',
          depName: 'node',
          depType: 'final',
          replaceString: 'node:8.9.0-alpine',
        },
      ]);
    });

    it('handles digest', () => {
      const res = extractPackageFile(
        'FROM node@sha256:eb85fc5b1198f5e1ec025ea07586bdbbf397e7d82df66c90d7511f533517e063\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest:
            'sha256:eb85fc5b1198f5e1ec025ea07586bdbbf397e7d82df66c90d7511f533517e063',
          currentValue: undefined,
          datasource: 'docker',
          depName: 'node',
          depType: 'final',
          replaceString:
            'node@sha256:eb85fc5b1198f5e1ec025ea07586bdbbf397e7d82df66c90d7511f533517e063',
        },
      ]);
    });

    it('handles tag and digest', () => {
      const res = extractPackageFile(
        'FROM node:8.9.0@sha256:eb85fc5b1198f5e1ec025ea07586bdbbf397e7d82df66c90d7511f533517e063\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest:
            'sha256:eb85fc5b1198f5e1ec025ea07586bdbbf397e7d82df66c90d7511f533517e063',
          currentValue: '8.9.0',
          datasource: 'docker',
          depName: 'node',
          depType: 'final',
          replaceString:
            'node:8.9.0@sha256:eb85fc5b1198f5e1ec025ea07586bdbbf397e7d82df66c90d7511f533517e063',
        },
      ]);
    });

    it('handles from as', () => {
      const res = extractPackageFile(
        'FROM node:8.9.0-alpine as base\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '8.9.0-alpine',
          datasource: 'docker',
          depName: 'node',
          depType: 'final',
          replaceString: 'node:8.9.0-alpine',
        },
      ]);
    });

    it('handles comments', () => {
      const res = extractPackageFile(
        '# some comment\n# another\n\nFROM node\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'node',
          depType: 'final',
          replaceString: 'node',
        },
      ]);
    });

    it('handles custom hosts', () => {
      const res = extractPackageFile(
        'FROM registry2.something.info/node:8\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '8',
          datasource: 'docker',
          depName: 'registry2.something.info/node',
          depType: 'final',
          replaceString: 'registry2.something.info/node:8',
        },
      ]);
    });

    it('handles custom hosts and suffix', () => {
      const res = extractPackageFile(
        'FROM registry2.something.info/node:8-alpine\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '8-alpine',
          datasource: 'docker',
          depName: 'registry2.something.info/node',
          depType: 'final',
          replaceString: 'registry2.something.info/node:8-alpine',
        },
      ]);
    });

    it('handles custom hosts with port', () => {
      const res = extractPackageFile(
        'FROM registry2.something.info:5005/node:8\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '8',
          datasource: 'docker',
          depName: 'registry2.something.info:5005/node',
          depType: 'final',
          replaceString: 'registry2.something.info:5005/node:8',
        },
      ]);
    });

    it('handles custom hosts with port without tag', () => {
      const res = extractPackageFile(
        'FROM registry2.something.info:5005/node\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'registry2.something.info:5005/node',
          depType: 'final',
          replaceString: 'registry2.something.info:5005/node',
        },
      ]);
    });

    it('handles quay hosts with port', () => {
      const res = extractPackageFile('FROM quay.io:1234/node\n', '', {})?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{packageName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'quay.io/node',
          depType: 'final',
          packageName: 'quay.io:1234/node',
          replaceString: 'quay.io:1234/node',
        },
      ]);
    });

    it('handles namespaced images', () => {
      const res = extractPackageFile('FROM mynamespace/node:8\n', '', {})?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '8',
          datasource: 'docker',
          depName: 'mynamespace/node',
          depType: 'final',
          replaceString: 'mynamespace/node:8',
        },
      ]);
    });

    it('handles custom hosts with namespace', () => {
      const res = extractPackageFile(
        'FROM registry2.something.info/someaccount/node:8\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '8',
          datasource: 'docker',
          depName: 'registry2.something.info/someaccount/node',
          depType: 'final',
          replaceString: 'registry2.something.info/someaccount/node:8',
        },
      ]);
    });

    it('handles abnormal spacing', () => {
      const res = extractPackageFile(
        'FROM    registry.allmine.info:5005/node:8.7.0\n\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '8.7.0',
          datasource: 'docker',
          depName: 'registry.allmine.info:5005/node',
          depType: 'final',
          replaceString: 'registry.allmine.info:5005/node:8.7.0',
        },
      ]);
    });

    it('extracts multiple FROM tags', () => {
      const res = extractPackageFile(
        'FROM node:6.12.3 as frontend\n\n# comment\nENV foo=bar\nFROM python:3.6-slim\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '6.12.3',
          datasource: 'docker',
          depName: 'node',
          depType: 'stage',
          replaceString: 'node:6.12.3',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '3.6-slim',
          datasource: 'docker',
          depName: 'python',
          depType: 'final',
          replaceString: 'python:3.6-slim',
        },
      ]);
    });

    it('skips scratches', () => {
      const res = extractPackageFile('FROM scratch\nADD foo\n', '', {});
      expect(res).toBeNull();
    });

    it('skips named multistage FROM tags', () => {
      const res = extractPackageFile(
        'FROM node:6.12.3 as frontend\n\n# comment\nENV foo=bar\nFROM frontend\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '6.12.3',
          datasource: 'docker',
          depName: 'node',
          depType: 'final',
          replaceString: 'node:6.12.3',
        },
      ]);
    });

    it('handles COPY --from', () => {
      const res = extractPackageFile(
        'FROM scratch\nCOPY --from=gcr.io/k8s-skaffold/skaffold:v0.11.0 /usr/bin/skaffold /usr/bin/skaffold\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'v0.11.0',
          datasource: 'docker',
          depName: 'gcr.io/k8s-skaffold/skaffold',
          depType: 'final',
          replaceString: 'gcr.io/k8s-skaffold/skaffold:v0.11.0',
        },
      ]);
    });

    it('skips named multistage COPY --from tags', () => {
      const res = extractPackageFile(
        'FROM node:6.12.3 as frontend\n\n# comment\nENV foo=bar\nCOPY --from=frontend /usr/bin/node /usr/bin/node\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '6.12.3',
          datasource: 'docker',
          depName: 'node',
          depType: 'final',
          replaceString: 'node:6.12.3',
        },
      ]);
    });

    it('skips index reference COPY --from tags', () => {
      const res = extractPackageFile(
        'FROM node:6.12.3 as frontend\n\n# comment\nENV foo=bar\nCOPY --from=0 /usr/bin/node /usr/bin/node\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '6.12.3',
          datasource: 'docker',
          depName: 'node',
          depType: 'final',
          replaceString: 'node:6.12.3',
        },
      ]);
    });

    it('detects ["stage"] and ["final"] deps of docker multi-stage build.', () => {
      const res = extractPackageFile(
        'FROM node:8.15.1-alpine as skippedfrom\nFROM golang:1.7.3 as builder\n\n# comment\nWORKDIR /go/src/github.com/alexellis/href-counter/\nRUN go get -d -v golang.org/x/net/html  \nCOPY app.go    .\nRUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o app .\n\nFROM alpine:latest  \nRUN apk --no-cache add ca-certificates\nWORKDIR /root/\nCOPY --from=builder /go/src/github.com/alexellis/href-counter/app .\nCMD ["./app"]\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '8.15.1-alpine',
          datasource: 'docker',
          depName: 'node',
          depType: 'stage',
          replaceString: 'node:8.15.1-alpine',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '1.7.3',
          datasource: 'docker',
          depName: 'golang',
          depType: 'stage',
          replaceString: 'golang:1.7.3',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'latest',
          datasource: 'docker',
          depName: 'alpine',
          depType: 'final',
          replaceString: 'alpine:latest',
        },
      ]);
      const passed = [
        res?.[2].depType === 'final',
        res?.[1].depType === 'stage',
        res?.[0].depType === 'stage',
      ].every(Boolean);
      expect(passed).toBeTrue();
    });

    it('extracts images on adjacent lines', () => {
      const res = extractPackageFile(d1, '', {})?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest:
            'sha256:d743b4141b02fcfb8beb68f92b4cd164f60ee457bf2d053f36785bf86de16b0d',
          currentValue: '8.11.3-alpine',
          datasource: 'docker',
          depName: 'node',
          depType: 'stage',
          replaceString:
            'node:8.11.3-alpine@sha256:d743b4141b02fcfb8beb68f92b4cd164f60ee457bf2d053f36785bf86de16b0d',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '1.1.1',
          datasource: 'docker',
          depName: 'buildkite/puppeteer',
          depType: 'final',
          replaceString: 'buildkite/puppeteer:1.1.1',
        },
      ]);
    });

    it('extracts images from all sorts of (maybe multiline) FROM and COPY --from statements', () => {
      const res = extractPackageFile(d2, '', {})?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'image1',
          depType: 'stage',
          replaceString: 'image1',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: 'sha256:abcdef',
          currentValue: '1.0.0',
          datasource: 'docker',
          depName: 'image2',
          depType: 'stage',
          replaceString: 'image2:1.0.0@sha256:abcdef',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'image4',
          depType: 'stage',
          replaceString: 'image4',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'image5',
          depType: 'stage',
          replaceString: 'image5',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'image6',
          depType: 'stage',
          replaceString: 'image6',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: 'sha256:abcdef',
          currentValue: '1.0.0',
          datasource: 'docker',
          depName: 'image7',
          depType: 'stage',
          replaceString: 'image7:1.0.0@sha256:abcdef',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'image11',
          depType: 'stage',
          replaceString: 'image11',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'image12',
          depType: 'stage',
          replaceString: 'image12',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'image13',
          depType: 'final',
          replaceString: 'image13',
        },
      ]);
    });

    it('handles calico/node', () => {
      const res = extractPackageFile('FROM calico/node\n', '', {})?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'calico/node',
          depType: 'final',
          replaceString: 'calico/node',
        },
      ]);
    });

    it('handles ubuntu', () => {
      const res = extractPackageFile('FROM ubuntu:18.04\n', '', {})?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '18.04',
          datasource: 'docker',
          depName: 'ubuntu',
          depType: 'final',
          replaceString: 'ubuntu:18.04',
          versioning: 'ubuntu',
        },
      ]);
    });

    it('handles debian with codename', () => {
      const res = extractPackageFile('FROM debian:buster\n', '', {})?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'buster',
          datasource: 'docker',
          depName: 'debian',
          depType: 'final',
          replaceString: 'debian:buster',
          versioning: 'debian',
        },
      ]);
    });

    it('handles debian with regular tag', () => {
      const res = extractPackageFile('FROM debian:11.4-slim\n', '', {})?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '11.4-slim',
          datasource: 'docker',
          depName: 'debian',
          depType: 'final',
          replaceString: 'debian:11.4-slim',
        },
      ]);
    });

    it('handles debian with prefixes', () => {
      const res = extractPackageFile('FROM amd64/debian:10\n', '', {})?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{packageName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '10',
          datasource: 'docker',
          depName: 'debian',
          depType: 'final',
          packageName: 'amd64/debian',
          replaceString: 'amd64/debian:10',
          versioning: 'debian',
        },
      ]);
    });

    it('handles prefixes', () => {
      const res = extractPackageFile('FROM amd64/ubuntu:18.04\n', '', {})?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{packageName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '18.04',
          datasource: 'docker',
          depName: 'ubuntu',
          depType: 'final',
          packageName: 'amd64/ubuntu',
          replaceString: 'amd64/ubuntu:18.04',
          versioning: 'ubuntu',
        },
      ]);
    });

    it('handles implausible line continuation', () => {
      const res = extractPackageFile(
        'FROM alpine:3.5\n\nRUN something \\',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '3.5',
          datasource: 'docker',
          depName: 'alpine',
          depType: 'final',
          replaceString: 'alpine:3.5',
        },
      ]);
    });

    it('handles multi-line FROM with space after escape character', () => {
      const res = extractPackageFile('FROM \\ \nnginx:1.20\n', '', {})?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '1.20',
          datasource: 'docker',
          depName: 'nginx',
          depType: 'final',
          replaceString: 'nginx:1.20',
        },
      ]);
    });

    it('handles FROM without ARG default value', () => {
      const res = extractPackageFile(
        'ARG img_base\nFROM $img_base\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          datasource: 'docker',
          depType: 'final',
          replaceString: '$img_base',
          skipReason: 'contains-variable',
        },
      ]);
    });

    it('handles FROM with empty ARG default value', () => {
      const res = extractPackageFile(
        'ARG patch1=""\nARG patch2=\nFROM nginx:1.20${patch1}$patch2\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            'FROM nginx:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}${patch1}$patch2',
          currentDigest: undefined,
          currentValue: '1.20',
          datasource: 'docker',
          depName: 'nginx',
          depType: 'final',
          replaceString: 'FROM nginx:1.20${patch1}$patch2',
        },
      ]);
    });

    it('handles FROM with version in ARG value', () => {
      const res = extractPackageFile(
        'ARG\tVARIANT="1.60.0-bullseye"\nFROM\trust:${VARIANT}\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            'ARG	VARIANT="{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}"',
          currentDigest: undefined,
          currentValue: '1.60.0-bullseye',
          datasource: 'docker',
          depName: 'rust',
          depType: 'final',
          replaceString: 'ARG	VARIANT="1.60.0-bullseye"',
        },
      ]);
    });

    it('handles FROM with version in ARG default value', () => {
      const res = extractPackageFile(
        'ARG IMAGE_VERSION=${IMAGE_VERSION:-ubuntu:xenial}\nfrom ${IMAGE_VERSION} as base\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            'ARG IMAGE_VERSION=${IMAGE_VERSION:-ubuntu:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}}',
          currentValue: 'xenial',
          datasource: 'docker',
          depName: 'ubuntu',
          depType: 'final',
          replaceString: 'ARG IMAGE_VERSION=${IMAGE_VERSION:-ubuntu:xenial}',
          versioning: 'ubuntu',
        },
      ]);
    });

    it('handles FROM with digest in ARG default value', () => {
      const res = extractPackageFile(
        'ARG sha_digest=sha256:ab37242e81cbc031b2600eef4440fe87055a05c14b40686df85078cc5086c98f\n' +
          '      FROM gcr.io/distroless/java17@$sha_digest',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            'ARG sha_digest={{#if newDigest}}{{newDigest}}{{/if}}',
          currentDigest:
            'sha256:ab37242e81cbc031b2600eef4440fe87055a05c14b40686df85078cc5086c98f',
          currentValue: undefined,
          datasource: 'docker',
          depName: 'gcr.io/distroless/java17',
          depType: 'final',
          replaceString:
            'ARG sha_digest=sha256:ab37242e81cbc031b2600eef4440fe87055a05c14b40686df85078cc5086c98f',
        },
      ]);
    });

    it('handles FROM with overwritten ARG value', () => {
      const res = extractPackageFile(
        'ARG base=nginx:1.19\nFROM $base as stage1\nARG base=nginx:1.20\nFROM --platform=amd64 $base as stage2\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            'ARG base=nginx:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '1.19',
          datasource: 'docker',
          depName: 'nginx',
          depType: 'stage',
          replaceString: 'ARG base=nginx:1.19',
        },
        {
          autoReplaceStringTemplate:
            'ARG base=nginx:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '1.20',
          datasource: 'docker',
          depName: 'nginx',
          depType: 'final',
          replaceString: 'ARG base=nginx:1.20',
        },
      ]);
    });

    it('handles FROM with multiple ARG values', () => {
      const res = extractPackageFile(
        'ARG CUDA=9.2\nARG LINUX_VERSION ubuntu16.04\nFROM nvidia/cuda:${CUDA}-devel-${LINUX_VERSION}\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '9.2-devel-ubuntu16.04',
          datasource: 'docker',
          depName: 'nvidia/cuda',
          depType: 'final',
          replaceString: 'nvidia/cuda:9.2-devel-ubuntu16.04',
        },
      ]);
    });

    it('skips scratch if provided in ARG value', () => {
      const res = extractPackageFile(
        'ARG img="scratch"\nFROM $img as base\n',
        '',
        {}
      );
      expect(res).toBeNull();
    });

    it('extracts images from multi-line ARG statements', () => {
      const res = extractPackageFile(d3, '', {})?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            ' ARG \\\n' +
            '\t# multi-line arg\n' +
            '   ALPINE_VERSION=alpine:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '3.15.4',
          datasource: 'docker',
          depName: 'alpine',
          depType: 'stage',
          replaceString:
            ' ARG \\\n' +
            '\t# multi-line arg\n' +
            '   ALPINE_VERSION=alpine:3.15.4',
        },
        {
          autoReplaceStringTemplate:
            'ARG   \\\n' +
            '  \\\n' +
            ' # multi-line arg\n' +
            ' # and multi-line comment\n' +
            '   nginx_version="nginx:{{#if newValue}}{{newValue}}{{/if}}@{{#if newDigest}}{{newDigest}}{{/if}}"',
          currentDigest:
            'sha256:ca9fac83c6c89a09424279de522214e865e322187b22a1a29b12747a4287b7bd',
          currentValue: '1.18.0-alpine',
          datasource: 'docker',
          depName: 'nginx',
          depType: 'final',
          replaceString:
            'ARG   \\\n' +
            '  \\\n' +
            ' # multi-line arg\n' +
            ' # and multi-line comment\n' +
            '   nginx_version="nginx:1.18.0-alpine@sha256:ca9fac83c6c89a09424279de522214e865e322187b22a1a29b12747a4287b7bd"',
        },
      ]);
    });

    it('ignores parser directives in wrong order', () => {
      const res = extractPackageFile(
        '# dummy\n# escape = `\n\nFROM\\\nnginx:1.20',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '1.20',
          datasource: 'docker',
          depName: 'nginx',
          depType: 'final',
          replaceString: 'nginx:1.20',
        },
      ]);
    });

    it('handles an alternative escape character', () => {
      const res = extractPackageFile(d4, '', {})?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            ' ARG `\n' +
            '\t# multi-line arg\n' +
            '   ALPINE_VERSION=alpine:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '3.15.4',
          datasource: 'docker',
          depName: 'alpine',
          depType: 'stage',
          replaceString:
            ' ARG `\n' +
            '\t# multi-line arg\n' +
            '   ALPINE_VERSION=alpine:3.15.4',
        },
        {
          autoReplaceStringTemplate:
            'ARG   `\n' +
            '  `\n' +
            ' # multi-line arg\n' +
            ' # and multi-line comment\n' +
            '   nginx_version="nginx:{{#if newValue}}{{newValue}}{{/if}}@{{#if newDigest}}{{newDigest}}{{/if}}"',
          currentDigest: 'sha256:abcdef',
          currentValue: '18.04',
          datasource: 'docker',
          depName: 'nginx',
          depType: 'stage',
          replaceString:
            'ARG   `\n' +
            '  `\n' +
            ' # multi-line arg\n' +
            ' # and multi-line comment\n' +
            '   nginx_version="nginx:18.04@sha256:abcdef"',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'image5',
          depType: 'stage',
          replaceString: 'image5',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'image12',
          depType: 'final',
          replaceString: 'image12',
        },
      ]);
    });

    it('handles FROM with version in ARG default value and quotes', () => {
      const res = extractPackageFile(
        'ARG REF_NAME=${REF_NAME:-"gcr.io/distroless/static-debian11:nonroot@sha256:abc"}\nfrom ${REF_NAME}',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            'ARG REF_NAME=${REF_NAME:-"gcr.io/distroless/static-debian11:{{#if newValue}}{{newValue}}{{/if}}@{{#if newDigest}}{{newDigest}}{{/if}}"}',
          currentDigest: 'sha256:abc',
          currentValue: 'nonroot',
          datasource: 'docker',
          depName: 'gcr.io/distroless/static-debian11',
          depType: 'final',
          replaceString:
            'ARG REF_NAME=${REF_NAME:-"gcr.io/distroless/static-debian11:nonroot@sha256:abc"}',
        },
      ]);
    });

    it('handles version in ARG and digest in FROM with CRLF linefeed', () => {
      const res = extractPackageFile(
        'ARG IMAGE_TAG=14.04\r\n#something unrelated\r\nFROM ubuntu:$IMAGE_TAG@sha256:abc\r\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            'ARG IMAGE_TAG={{#if newValue}}{{newValue}}{{/if}}\r\n#something unrelated\r\nFROM ubuntu:$IMAGE_TAG@{{#if newDigest}}{{newDigest}}{{/if}}',
          currentDigest: 'sha256:abc',
          currentValue: '14.04',
          datasource: 'docker',
          depName: 'ubuntu',
          depType: 'final',
          replaceString:
            'ARG IMAGE_TAG=14.04\r\n#something unrelated\r\nFROM ubuntu:$IMAGE_TAG@sha256:abc',
          versioning: 'ubuntu',
        },
      ]);
    });

    it('handles updates of multiple ARG values', () => {
      const res = extractPackageFile(
        '# random comment\n\n' +
          'ARG NODE_IMAGE_HASH="@sha256:ba9c961513b853210ae0ca1524274eafa5fd94e20b856343887ca7274c8450e4"\n' +
          'ARG NODE_IMAGE_HOST="docker.io/library/"\n' +
          'ARG NODE_IMAGE_NAME=node\n' +
          'ARG NODE_IMAGE_TAG="16.14.2-alpine3.14"\n' +
          'ARG DUMMY_PREFIX=\n' +
          'FROM ${DUMMY_PREFIX}${NODE_IMAGE_HOST}${NODE_IMAGE_NAME}:${NODE_IMAGE_TAG}${NODE_IMAGE_HASH} as yarn\n',
        '',
        {}
      )?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            'ARG NODE_IMAGE_HASH="@{{#if newDigest}}{{newDigest}}{{/if}}"\n' +
            'ARG NODE_IMAGE_HOST="docker.io/library/"\n' +
            'ARG NODE_IMAGE_NAME=node\n' +
            'ARG NODE_IMAGE_TAG="{{#if newValue}}{{newValue}}{{/if}}"',
          currentDigest:
            'sha256:ba9c961513b853210ae0ca1524274eafa5fd94e20b856343887ca7274c8450e4',
          currentValue: '16.14.2-alpine3.14',
          datasource: 'docker',
          depName: 'docker.io/library/node',
          depType: 'final',
          replaceString:
            'ARG NODE_IMAGE_HASH="@sha256:ba9c961513b853210ae0ca1524274eafa5fd94e20b856343887ca7274c8450e4"\n' +
            'ARG NODE_IMAGE_HOST="docker.io/library/"\n' +
            'ARG NODE_IMAGE_NAME=node\n' +
            'ARG NODE_IMAGE_TAG="16.14.2-alpine3.14"',
        },
      ]);
    });
  });

  it('handles empty optional parameters', () => {
    const res = extractPackageFile(
      'FROM quay.io/myName/myPackage:0.6.2\n',
      '',
      {}
    );
    expect(res).toEqual({
      deps: [
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '0.6.2',
          datasource: 'docker',
          depName: 'quay.io/myName/myPackage',
          depType: 'final',
          replaceString: 'quay.io/myName/myPackage:0.6.2',
        },
      ],
    });
  });

  it('handles registry alias', () => {
    const res = extractPackageFile(
      'FROM quay.io/myName/myPackage:0.6.2\n',
      'Dockerfile',
      {
        registryAliases: {
          'quay.io': 'my-quay-mirror.registry.com',
          'index.docker.io': 'my-docker-mirror.registry.com',
        },
      }
    );
    expect(res).toEqual({
      deps: [
        {
          autoReplaceStringTemplate:
            'quay.io/myName/myPackage:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '0.6.2',
          datasource: 'docker',
          depName: 'my-quay-mirror.registry.com/myName/myPackage',
          depType: 'final',
          replaceString: 'quay.io/myName/myPackage:0.6.2',
        },
      ],
    });
  });

  it('handles empty registry', () => {
    const res = extractPackageFile(
      'FROM myName/myPackage:0.6.2\n',
      'Dockerfile',
      {
        registryAliases: {
          'quay.io': 'my-quay-mirror.registry.com',
          'index.docker.io': 'my-docker-mirror.registry.com',
        },
      }
    );
    expect(res).toEqual({
      deps: [
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '0.6.2',
          datasource: 'docker',
          depName: 'myName/myPackage',
          depType: 'final',
          replaceString: 'myName/myPackage:0.6.2',
        },
      ],
    });
  });

  describe('getDep()', () => {
    it('rejects null', () => {
      expect(getDep(null)).toEqual({ skipReason: 'invalid-value' });
    });

    it('rejects empty or whitespace', () => {
      expect(getDep('')).toEqual({ skipReason: 'invalid-value' });
    });

    it('handles default environment variable values', () => {
      const res = getDep('${REDIS_IMAGE:-redis:5.0.0@sha256:abcd}');
      expect(res).toEqual({
        autoReplaceStringTemplate:
          '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
        currentDigest: 'sha256:abcd',
        currentValue: '5.0.0',
        datasource: 'docker',
        depName: 'redis',
        replaceString: 'redis:5.0.0@sha256:abcd',
      });

      const res2 = getDep('${REDIS_IMAGE:-redis:5.0.0}');
      expect(res2).toEqual({
        autoReplaceStringTemplate:
          '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
        currentValue: '5.0.0',
        datasource: 'docker',
        depName: 'redis',
        replaceString: 'redis:5.0.0',
      });

      const res3 = getDep('${REDIS_IMAGE:-redis@sha256:abcd}');
      expect(res3).toEqual({
        autoReplaceStringTemplate:
          '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
        currentDigest: 'sha256:abcd',
        datasource: 'docker',
        depName: 'redis',
        replaceString: 'redis@sha256:abcd',
      });

      const res4 = getDep(
        '${REF_NAME:-"gcr.io/distroless/static-debian11:nonroot@sha256:abc"}'
      );
      expect(res4).toEqual({
        autoReplaceStringTemplate:
          '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
        currentDigest: 'sha256:abc',
        currentValue: 'nonroot',
        datasource: 'docker',
        depName: 'gcr.io/distroless/static-debian11',
        replaceString: 'gcr.io/distroless/static-debian11:nonroot@sha256:abc',
      });

      const res5 = getDep(
        '${REF_NAME:+-gcr.io/distroless/static-debian11:nonroot@sha256:abc}'
      );
      expect(res5).toEqual({
        autoReplaceStringTemplate:
          '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
        datasource: 'docker',
        replaceString:
          '${REF_NAME:+-gcr.io/distroless/static-debian11:nonroot@sha256:abc}',
        skipReason: 'contains-variable',
      });
    });

    it('skips tag containing a variable', () => {
      const res = getDep('mcr.microsoft.com/dotnet/sdk:5.0${IMAGESUFFIX}');
      expect(res).toEqual({
        autoReplaceStringTemplate:
          '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
        datasource: 'docker',
        replaceString: 'mcr.microsoft.com/dotnet/sdk:5.0${IMAGESUFFIX}',
        skipReason: 'contains-variable',
      });
    });

    it('skips depName containing a non default variable at start', () => {
      const res = getDep('$CI_REGISTRY/alpine:3.15');
      expect(res).toEqual({
        autoReplaceStringTemplate:
          '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
        datasource: 'docker',
        replaceString: '$CI_REGISTRY/alpine:3.15',
        skipReason: 'contains-variable',
      });
    });

    it('skips depName containing a non default variable with brackets at start', () => {
      const res = getDep('${CI_REGISTRY}/alpine:3.15');
      expect(res).toEqual({
        autoReplaceStringTemplate:
          '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
        datasource: 'docker',
        replaceString: '${CI_REGISTRY}/alpine:3.15',
        skipReason: 'contains-variable',
      });
    });

    it('skips depName containing a non default variable', () => {
      const res = getDep('docker.io/$PREFIX/alpine:3.15');
      expect(res).toEqual({
        autoReplaceStringTemplate:
          '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
        datasource: 'docker',
        replaceString: 'docker.io/$PREFIX/alpine:3.15',
        skipReason: 'contains-variable',
      });
    });

    it('skips depName containing a non default variable with brackets', () => {
      const res = getDep('docker.io/${PREFIX}/alpine:3.15');
      expect(res).toEqual({
        autoReplaceStringTemplate:
          '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
        datasource: 'docker',
        replaceString: 'docker.io/${PREFIX}/alpine:3.15',
        skipReason: 'contains-variable',
      });
    });

    const versionAndDigestTemplate =
      ':{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}';
    const defaultAutoReplaceStringTemplate =
      '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}';

    it.each`
      name                         | registryAliases                                         | imageName                     | dep
      ${'multiple aliases'}        | ${{ foo: 'foo.registry.com', bar: 'bar.registry.com' }} | ${'foo/image:1.0'}            | ${{ depName: 'foo.registry.com/image', currentValue: '1.0', autoReplaceStringTemplate: `foo/image${versionAndDigestTemplate}` }}
      ${'aliased variable'}        | ${{ $CI_REGISTRY: 'registry.com' }}                     | ${'$CI_REGISTRY/image:1.0'}   | ${{ depName: 'registry.com/image', currentValue: '1.0', autoReplaceStringTemplate: `$CI_REGISTRY/image${versionAndDigestTemplate}` }}
      ${'variables with brackets'} | ${{ '${CI_REGISTRY}': 'registry.com' }}                 | ${'${CI_REGISTRY}/image:1.0'} | ${{ depName: 'registry.com/image', currentValue: '1.0', autoReplaceStringTemplate: `$\{CI_REGISTRY}/image${versionAndDigestTemplate}` }}
      ${'not aliased variable'}    | ${{}}                                                   | ${'$CI_REGISTRY/image:1.0'}   | ${{ autoReplaceStringTemplate: defaultAutoReplaceStringTemplate }}
      ${'plain image'}             | ${{}}                                                   | ${'registry.com/image:1.0'}   | ${{ depName: 'registry.com/image', currentValue: '1.0', autoReplaceStringTemplate: defaultAutoReplaceStringTemplate }}
    `(
      'supports registry aliases - $name',
      ({
        registryAliases,
        imageName,
        dep,
      }: {
        registryAliases: Record<string, string>;
        imageName: string;
        dep: PackageDependency;
      }) => {
        expect(getDep(imageName, true, registryAliases)).toMatchObject({
          ...dep,
          replaceString: imageName,
        });
      }
    );
  });

  describe('extractVariables()', () => {
    it('handles no variable', () => {
      expect(extractVariables('nginx:latest')).toBeEmpty();
    });

    it('handles simple variable', () => {
      expect(extractVariables('nginx:$version')).toMatchObject({
        $version: 'version',
      });
    });

    it('handles escaped variable', () => {
      expect(extractVariables('nginx:\\$version')).toMatchObject({
        '\\$version': 'version',
      });
    });

    it('handles complex variable', () => {
      expect(extractVariables('ubuntu:${ubuntu_version}')).toMatchObject({
        '${ubuntu_version}': 'ubuntu_version',
      });
    });

    it('handles complex variable with static default value', () => {
      expect(extractVariables('${var1:-nginx}:latest')).toMatchObject({
        '${var1:-nginx}': 'var1',
      });
    });

    it('handles complex variable with other variable as default value', () => {
      expect(extractVariables('${VAR1:-$var2}:latest')).toMatchObject({
        '${VAR1:-$var2}': 'VAR1',
      });
    });

    it('handles multiple variables', () => {
      expect(extractVariables('${var1:-$var2}:$version')).toMatchObject({
        '${var1:-$var2}': 'var1',
        $version: 'version',
      });
    });
  });
});
