import { loadFixture } from '../../../../test/util';
import { extractPackageFile, getDep } from './extract';

const d1 = loadFixture('1.Dockerfile');
const d2 = loadFixture('2.Dockerfile');

describe('modules/manager/dockerfile/extract', () => {
  describe('extractPackageFile()', () => {
    it('handles no FROM', () => {
      const res = extractPackageFile('no from!');
      expect(res).toBeNull();
    });

    it('handles naked dep', () => {
      const res = extractPackageFile('FROM node\n').deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "replaceString": "node",
          },
        ]
      `);
    });

    it('is case insensitive', () => {
      const res = extractPackageFile('From node\n').deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "replaceString": "node",
          },
        ]
      `);
    });

    it('handles tag', () => {
      const res = extractPackageFile('FROM node:8.9.0-alpine\n').deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "8.9.0-alpine",
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "replaceString": "node:8.9.0-alpine",
          },
        ]
      `);
    });

    it('handles digest', () => {
      const res = extractPackageFile(
        'FROM node@sha256:eb85fc5b1198f5e1ec025ea07586bdbbf397e7d82df66c90d7511f533517e063\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": "sha256:eb85fc5b1198f5e1ec025ea07586bdbbf397e7d82df66c90d7511f533517e063",
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "replaceString": "node@sha256:eb85fc5b1198f5e1ec025ea07586bdbbf397e7d82df66c90d7511f533517e063",
          },
        ]
      `);
    });

    it('handles tag and digest', () => {
      const res = extractPackageFile(
        'FROM node:8.9.0@sha256:eb85fc5b1198f5e1ec025ea07586bdbbf397e7d82df66c90d7511f533517e063\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": "sha256:eb85fc5b1198f5e1ec025ea07586bdbbf397e7d82df66c90d7511f533517e063",
            "currentValue": "8.9.0",
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "replaceString": "node:8.9.0@sha256:eb85fc5b1198f5e1ec025ea07586bdbbf397e7d82df66c90d7511f533517e063",
          },
        ]
      `);
    });

    it('handles from as', () => {
      const res = extractPackageFile('FROM node:8.9.0-alpine as base\n').deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "8.9.0-alpine",
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "replaceString": "node:8.9.0-alpine",
          },
        ]
      `);
    });

    it('handles comments', () => {
      const res = extractPackageFile(
        '# some comment\n# another\n\nFROM node\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "replaceString": "node",
          },
        ]
      `);
    });

    it('handles custom hosts', () => {
      const res = extractPackageFile(
        'FROM registry2.something.info/node:8\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "8",
            "datasource": "docker",
            "depName": "registry2.something.info/node",
            "depType": "final",
            "replaceString": "registry2.something.info/node:8",
          },
        ]
      `);
    });

    it('handles custom hosts and suffix', () => {
      const res = extractPackageFile(
        'FROM registry2.something.info/node:8-alpine\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "8-alpine",
            "datasource": "docker",
            "depName": "registry2.something.info/node",
            "depType": "final",
            "replaceString": "registry2.something.info/node:8-alpine",
          },
        ]
      `);
    });

    it('handles custom hosts with port', () => {
      const res = extractPackageFile(
        'FROM registry2.something.info:5005/node:8\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "8",
            "datasource": "docker",
            "depName": "registry2.something.info:5005/node",
            "depType": "final",
            "replaceString": "registry2.something.info:5005/node:8",
          },
        ]
      `);
      expect(res[0].depName).toBe('registry2.something.info:5005/node');
      expect(res[0].currentValue).toBe('8');
    });

    it('handles custom hosts with port without tag', () => {
      const res = extractPackageFile(
        'FROM registry2.something.info:5005/node\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "registry2.something.info:5005/node",
            "depType": "final",
            "replaceString": "registry2.something.info:5005/node",
          },
        ]
      `);
      expect(res[0].depName).toBe('registry2.something.info:5005/node');
    });

    it('handles quay hosts with port', () => {
      const res = extractPackageFile('FROM quay.io:1234/node\n').deps;
      expect(res[0]).toMatchInlineSnapshot(`
        Object {
          "autoReplaceStringTemplate": "{{packageName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
          "currentDigest": undefined,
          "currentValue": undefined,
          "datasource": "docker",
          "depName": "quay.io/node",
          "depType": "final",
          "packageName": "quay.io:1234/node",
          "replaceString": "quay.io:1234/node",
        }
      `);
    });

    it('handles namespaced images', () => {
      const res = extractPackageFile('FROM mynamespace/node:8\n').deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "8",
            "datasource": "docker",
            "depName": "mynamespace/node",
            "depType": "final",
            "replaceString": "mynamespace/node:8",
          },
        ]
      `);
    });

    it('handles custom hosts with namespace', () => {
      const res = extractPackageFile(
        'FROM registry2.something.info/someaccount/node:8\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "8",
            "datasource": "docker",
            "depName": "registry2.something.info/someaccount/node",
            "depType": "final",
            "replaceString": "registry2.something.info/someaccount/node:8",
          },
        ]
      `);
    });

    it('handles abnormal spacing', () => {
      const res = extractPackageFile(
        'FROM    registry.allmine.info:5005/node:8.7.0\n\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "8.7.0",
            "datasource": "docker",
            "depName": "registry.allmine.info:5005/node",
            "depType": "final",
            "replaceString": "registry.allmine.info:5005/node:8.7.0",
          },
        ]
      `);
    });

    it('extracts multiple FROM tags', () => {
      const res = extractPackageFile(
        'FROM node:6.12.3 as frontend\n\n# comment\nENV foo=bar\nFROM python:3.6-slim\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "6.12.3",
            "datasource": "docker",
            "depName": "node",
            "depType": "stage",
            "replaceString": "node:6.12.3",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "3.6-slim",
            "datasource": "docker",
            "depName": "python",
            "depType": "final",
            "replaceString": "python:3.6-slim",
          },
        ]
      `);
      expect(res).toHaveLength(2);
    });

    it('skips scratches', () => {
      const res = extractPackageFile('FROM scratch\nADD foo\n');
      expect(res).toBeNull();
    });

    it('skips named multistage FROM tags', () => {
      const res = extractPackageFile(
        'FROM node:6.12.3 as frontend\n\n# comment\nENV foo=bar\nFROM frontend\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "6.12.3",
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "replaceString": "node:6.12.3",
          },
        ]
      `);
      expect(res).toHaveLength(1);
    });

    it('handles COPY --from', () => {
      const res = extractPackageFile(
        'FROM scratch\nCOPY --from=gcr.io/k8s-skaffold/skaffold:v0.11.0 /usr/bin/skaffold /usr/bin/skaffold\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "v0.11.0",
            "datasource": "docker",
            "depName": "gcr.io/k8s-skaffold/skaffold",
            "depType": "final",
            "replaceString": "gcr.io/k8s-skaffold/skaffold:v0.11.0",
          },
        ]
      `);
    });

    it('skips named multistage COPY --from tags', () => {
      const res = extractPackageFile(
        'FROM node:6.12.3 as frontend\n\n# comment\nENV foo=bar\nCOPY --from=frontend /usr/bin/node /usr/bin/node\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "6.12.3",
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "replaceString": "node:6.12.3",
          },
        ]
      `);
      expect(res).toHaveLength(1);
    });

    it('skips index reference COPY --from tags', () => {
      const res = extractPackageFile(
        'FROM node:6.12.3 as frontend\n\n# comment\nENV foo=bar\nCOPY --from=0 /usr/bin/node /usr/bin/node\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "6.12.3",
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "replaceString": "node:6.12.3",
          },
        ]
      `);
      expect(res).toHaveLength(1);
    });

    it('detects ["stage"] and ["final"] deps of docker multi-stage build.', () => {
      const res = extractPackageFile(
        'FROM node:8.15.1-alpine as skippedfrom\nFROM golang:1.7.3 as builder\n\n# comment\nWORKDIR /go/src/github.com/alexellis/href-counter/\nRUN go get -d -v golang.org/x/net/html  \nCOPY app.go    .\nRUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o app .\n\nFROM alpine:latest  \nRUN apk --no-cache add ca-certificates\nWORKDIR /root/\nCOPY --from=builder /go/src/github.com/alexellis/href-counter/app .\nCMD ["./app"]\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "8.15.1-alpine",
            "datasource": "docker",
            "depName": "node",
            "depType": "stage",
            "replaceString": "node:8.15.1-alpine",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "1.7.3",
            "datasource": "docker",
            "depName": "golang",
            "depType": "stage",
            "replaceString": "golang:1.7.3",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "latest",
            "datasource": "docker",
            "depName": "alpine",
            "depType": "final",
            "replaceString": "alpine:latest",
          },
        ]
      `);
      const passed = [
        res[2].depType === 'final',
        res[1].depType === 'stage',
        res[0].depType === 'stage',
      ].every(Boolean);
      expect(passed).toBeTrue();
    });

    it('extracts images on adjacent lines', () => {
      const res = extractPackageFile(d1).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": "sha256:d743b4141b02fcfb8beb68f92b4cd164f60ee457bf2d053f36785bf86de16b0d",
            "currentValue": "8.11.3-alpine",
            "datasource": "docker",
            "depName": "node",
            "depType": "stage",
            "replaceString": "node:8.11.3-alpine@sha256:d743b4141b02fcfb8beb68f92b4cd164f60ee457bf2d053f36785bf86de16b0d",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "1.1.1",
            "datasource": "docker",
            "depName": "buildkite/puppeteer",
            "depType": "final",
            "replaceString": "buildkite/puppeteer:1.1.1",
          },
        ]
      `);
      expect(res).toHaveLength(2);
    });

    it('extracts images from all sorts of (maybe multiline) FROM and COPY --from statements', () => {
      const res = extractPackageFile(d2).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "image1",
            "depType": "stage",
            "replaceString": "image1",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": "sha256:abcdef",
            "currentValue": "1.0.0",
            "datasource": "docker",
            "depName": "image2",
            "depType": "stage",
            "replaceString": "image2:1.0.0@sha256:abcdef",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "image4",
            "depType": "stage",
            "replaceString": "image4",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "image5",
            "depType": "stage",
            "replaceString": "image5",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "image6",
            "depType": "stage",
            "replaceString": "image6",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": "sha256:abcdef",
            "currentValue": "1.0.0",
            "datasource": "docker",
            "depName": "image7",
            "depType": "stage",
            "replaceString": "image7:1.0.0@sha256:abcdef",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "image11",
            "depType": "stage",
            "replaceString": "image11",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "image12",
            "depType": "stage",
            "replaceString": "image12",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "image13",
            "depType": "final",
            "replaceString": "image13",
          },
        ]
      `);
      expect(res).toHaveLength(9);
    });

    it('handles calico/node', () => {
      const res = extractPackageFile('FROM calico/node\n').deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "calico/node",
            "depType": "final",
            "replaceString": "calico/node",
          },
        ]
      `);
    });

    it('handles ubuntu', () => {
      const res = extractPackageFile('FROM ubuntu:18.04\n').deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "18.04",
            "datasource": "docker",
            "depName": "ubuntu",
            "depType": "final",
            "replaceString": "ubuntu:18.04",
            "versioning": "ubuntu",
          },
        ]
      `);
    });

    it('handles debian with codename', () => {
      const res = extractPackageFile('FROM debian:buster\n').deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "buster",
            "datasource": "docker",
            "depName": "debian",
            "depType": "final",
            "replaceString": "debian:buster",
            "versioning": "debian",
          },
        ]
      `);
    });

    it('handles debian with prefixes', () => {
      const res = extractPackageFile('FROM amd64/debian:10\n').deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{packageName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "10",
            "datasource": "docker",
            "depName": "debian",
            "depType": "final",
            "packageName": "amd64/debian",
            "replaceString": "amd64/debian:10",
            "versioning": "debian",
          },
        ]
      `);
    });

    it('handles prefixes', () => {
      const res = extractPackageFile('FROM amd64/ubuntu:18.04\n').deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{packageName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "18.04",
            "datasource": "docker",
            "depName": "ubuntu",
            "depType": "final",
            "packageName": "amd64/ubuntu",
            "replaceString": "amd64/ubuntu:18.04",
            "versioning": "ubuntu",
          },
        ]
      `);
    });
  });
  describe('getDep()', () => {
    it('rejects null', () => {
      expect(getDep(null)).toEqual({ skipReason: 'invalid-value' });
    });

    it('handles default environment variable values', () => {
      const res = getDep('${REDIS_IMAGE:-redis:5.0.0@sha256:abcd}');
      expect(res).toMatchInlineSnapshot(`
Object {
  "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
  "currentDigest": "sha256:abcd",
  "currentValue": "5.0.0",
  "datasource": "docker",
  "depName": "redis",
  "replaceString": "redis:5.0.0@sha256:abcd",
}
`);

      const res2 = getDep('${REDIS_IMAGE:-redis:5.0.0}');
      expect(res2).toMatchInlineSnapshot(`
Object {
  "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
  "currentValue": "5.0.0",
  "datasource": "docker",
  "depName": "redis",
  "replaceString": "redis:5.0.0",
}
`);

      const res3 = getDep('${REDIS_IMAGE:-redis@sha256:abcd}');
      expect(res3).toMatchInlineSnapshot(`
Object {
  "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
  "currentDigest": "sha256:abcd",
  "datasource": "docker",
  "depName": "redis",
  "replaceString": "redis@sha256:abcd",
}
`);
    });

    it('skips tag containing a variable', () => {
      const res = getDep('mcr.microsoft.com/dotnet/sdk:5.0${IMAGESUFFIX}');
      expect(res).toMatchInlineSnapshot(`
        Object {
          "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
          "datasource": "docker",
          "replaceString": "mcr.microsoft.com/dotnet/sdk:5.0\${IMAGESUFFIX}",
          "skipReason": "contains-variable",
        }
      `);
    });

    it('skips depName containing a non default variable at start', () => {
      const res = getDep('$CI_REGISTRY/alpine:3.15');
      expect(res).toMatchInlineSnapshot(`
        Object {
          "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
          "datasource": "docker",
          "replaceString": "$CI_REGISTRY/alpine:3.15",
          "skipReason": "contains-variable",
        }
      `);
    });

    it('skips depName containing a non default variable with brackets at start', () => {
      const res = getDep('${CI_REGISTRY}/alpine:3.15');
      expect(res).toMatchInlineSnapshot(`
        Object {
          "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
          "datasource": "docker",
          "replaceString": "\${CI_REGISTRY}/alpine:3.15",
          "skipReason": "contains-variable",
        }
      `);
    });

    it('skips depName containing a non default variable', () => {
      const res = getDep('docker.io/$PREFIX/alpine:3.15');
      expect(res).toMatchInlineSnapshot(`
        Object {
          "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
          "datasource": "docker",
          "replaceString": "docker.io/$PREFIX/alpine:3.15",
          "skipReason": "contains-variable",
        }
      `);
    });

    it('skips depName containing a non default variable with brackets', () => {
      const res = getDep('docker.io/${PREFIX}/alpine:3.15');
      expect(res).toMatchInlineSnapshot(`
        Object {
          "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
          "datasource": "docker",
          "replaceString": "docker.io/\${PREFIX}/alpine:3.15",
          "skipReason": "contains-variable",
        }
      `);
    });
  });
});
