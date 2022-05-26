import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile, extractVariables, getDep } from './extract';

const d1 = Fixtures.get('1.Dockerfile');
const d2 = Fixtures.get('2.Dockerfile');
const d3 = Fixtures.get('3.Dockerfile');
const d4 = Fixtures.get('4.Dockerfile');

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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  3,
                  3,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
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
          "managerData": Object {
            "lineNumberRanges": Array [
              Array [
                0,
                0,
              ],
            ],
          },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
            "replaceString": "node:6.12.3",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "3.6-slim",
            "datasource": "docker",
            "depName": "python",
            "depType": "final",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  4,
                  4,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  1,
                  1,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
            "replaceString": "node:8.15.1-alpine",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "1.7.3",
            "datasource": "docker",
            "depName": "golang",
            "depType": "stage",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  1,
                  1,
                ],
              ],
            },
            "replaceString": "golang:1.7.3",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "latest",
            "datasource": "docker",
            "depName": "alpine",
            "depType": "final",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  9,
                  9,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  2,
                  2,
                ],
              ],
            },
            "replaceString": "node:8.11.3-alpine@sha256:d743b4141b02fcfb8beb68f92b4cd164f60ee457bf2d053f36785bf86de16b0d",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "1.1.1",
            "datasource": "docker",
            "depName": "buildkite/puppeteer",
            "depType": "final",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  3,
                  3,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  1,
                  1,
                ],
              ],
            },
            "replaceString": "image1",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": "sha256:abcdef",
            "currentValue": "1.0.0",
            "datasource": "docker",
            "depName": "image2",
            "depType": "stage",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  3,
                  4,
                ],
              ],
            },
            "replaceString": "image2:1.0.0@sha256:abcdef",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "image4",
            "depType": "stage",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  8,
                  11,
                ],
              ],
            },
            "replaceString": "image4",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "image5",
            "depType": "stage",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  13,
                  17,
                ],
              ],
            },
            "replaceString": "image5",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "image6",
            "depType": "stage",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  20,
                  20,
                ],
              ],
            },
            "replaceString": "image6",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": "sha256:abcdef",
            "currentValue": "1.0.0",
            "datasource": "docker",
            "depName": "image7",
            "depType": "stage",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  22,
                  26,
                ],
              ],
            },
            "replaceString": "image7:1.0.0@sha256:abcdef",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "image11",
            "depType": "stage",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  30,
                  30,
                ],
              ],
            },
            "replaceString": "image11",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "image12",
            "depType": "stage",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  32,
                  36,
                ],
              ],
            },
            "replaceString": "image12",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "image13",
            "depType": "final",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  38,
                  38,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
            "replaceString": "ubuntu:18.04",
            "versioning": "ubuntu",
          },
        ]
      `);
    });

    it('handles debian with codename', () => {
      const res = extractPackageFile('FROM debian:buster\n').deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'buster',
          datasource: 'docker',
          depName: 'debian',
          depType: 'final',
          managerData: { lineNumberRanges: [[0, 0]] },
          replaceString: 'debian:buster',
          versioning: 'debian',
        },
      ]);
    });

    it('handles debian with prefixes', () => {
      const res = extractPackageFile('FROM amd64/debian:10\n').deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{packageName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '10',
          datasource: 'docker',
          depName: 'debian',
          depType: 'final',
          managerData: { lineNumberRanges: [[0, 0]] },
          packageName: 'amd64/debian',
          replaceString: 'amd64/debian:10',
          versioning: 'debian',
        },
      ]);
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
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
            "packageName": "amd64/ubuntu",
            "replaceString": "amd64/ubuntu:18.04",
            "versioning": "ubuntu",
          },
        ]
      `);
    });

    it('handles implausible line continuation', () => {
      const res = extractPackageFile(
        'FROM alpine:3.5\n\nRUN something \\'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "3.5",
            "datasource": "docker",
            "depName": "alpine",
            "depType": "final",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  0,
                ],
              ],
            },
            "replaceString": "alpine:3.5",
          },
        ]
      `);
    });

    it('handles multi-line FROM with space after escape character', () => {
      const res = extractPackageFile('FROM \\ \nnginx:1.20\n').deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "1.20",
            "datasource": "docker",
            "depName": "nginx",
            "depType": "final",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  0,
                  1,
                ],
              ],
            },
            "replaceString": "nginx:1.20",
          },
        ]
      `);
    });

    it('handles FROM without ARG default value', () => {
      const res = extractPackageFile('ARG img_base\nFROM $img_base\n').deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "datasource": "docker",
            "depType": "final",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  1,
                  1,
                ],
              ],
            },
            "replaceString": "$img_base",
            "skipReason": "contains-variable",
          },
        ]
      `);
    });

    it('handles FROM with empty ARG default value', () => {
      const res = extractPackageFile(
        'ARG patch1=""\nARG patch2=\nFROM nginx:1.20${patch1}$patch2\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "1.20",
            "datasource": "docker",
            "depName": "nginx",
            "depType": "final",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  2,
                  2,
                ],
                Array [
                  0,
                  0,
                ],
                Array [
                  1,
                  1,
                ],
              ],
            },
            "replaceString": "nginx:1.20",
          },
        ]
      `);
    });

    it('handles FROM with version in ARG value', () => {
      const res = extractPackageFile(
        'ARG\tVARIANT="1.60.0-bullseye"\nFROM\trust:${VARIANT}\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "1.60.0-bullseye",
            "datasource": "docker",
            "depName": "rust",
            "depType": "final",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  1,
                  1,
                ],
                Array [
                  0,
                  0,
                ],
              ],
            },
            "replaceString": "rust:1.60.0-bullseye",
          },
        ]
      `);
    });

    it('handles FROM with version in ARG default value', () => {
      const res = extractPackageFile(
        'ARG IMAGE_VERSION=${IMAGE_VERSION:-ubuntu:xenial}\nfrom ${IMAGE_VERSION} as base\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentValue": "xenial",
            "datasource": "docker",
            "depName": "ubuntu",
            "depType": "final",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  1,
                  1,
                ],
                Array [
                  0,
                  0,
                ],
              ],
            },
            "replaceString": "ubuntu:xenial",
            "versioning": "ubuntu",
          },
        ]
      `);
    });

    it('handles FROM with overwritten ARG value', () => {
      const res = extractPackageFile(
        'ARG base=nginx:1.19\nFROM $base as stage1\nARG base=nginx:1.20\nFROM --platform=amd64 $base as stage2\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "1.19",
            "datasource": "docker",
            "depName": "nginx",
            "depType": "stage",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  1,
                  1,
                ],
                Array [
                  0,
                  0,
                ],
              ],
            },
            "replaceString": "nginx:1.19",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "1.20",
            "datasource": "docker",
            "depName": "nginx",
            "depType": "final",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  3,
                  3,
                ],
                Array [
                  2,
                  2,
                ],
              ],
            },
            "replaceString": "nginx:1.20",
          },
        ]
      `);
    });

    it('handles FROM with multiple ARG values', () => {
      const res = extractPackageFile(
        'ARG CUDA=9.2\nARG LINUX_VERSION ubuntu16.04\nFROM nvidia/cuda:${CUDA}-devel-${LINUX_VERSION}\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "9.2-devel-ubuntu16.04",
            "datasource": "docker",
            "depName": "nvidia/cuda",
            "depType": "final",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  2,
                  2,
                ],
                Array [
                  0,
                  0,
                ],
                Array [
                  1,
                  1,
                ],
              ],
            },
            "replaceString": "nvidia/cuda:9.2-devel-ubuntu16.04",
          },
        ]
      `);
    });

    it('skips scratch if provided in ARG value', () => {
      const res = extractPackageFile('ARG img="scratch"\nFROM $img as base\n');
      expect(res).toBeNull();
    });

    it('extracts images from multi-line ARG statements', () => {
      const res = extractPackageFile(d3).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "3.15.4",
            "datasource": "docker",
            "depName": "alpine",
            "depType": "stage",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  4,
                  5,
                ],
                Array [
                  0,
                  2,
                ],
              ],
            },
            "replaceString": "alpine:3.15.4",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": "sha256:ca9fac83c6c89a09424279de522214e865e322187b22a1a29b12747a4287b7bd",
            "currentValue": "1.18.0-alpine",
            "datasource": "docker",
            "depName": "nginx",
            "depType": "final",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  13,
                  13,
                ],
                Array [
                  7,
                  11,
                ],
              ],
            },
            "replaceString": "nginx:1.18.0-alpine@sha256:ca9fac83c6c89a09424279de522214e865e322187b22a1a29b12747a4287b7bd",
          },
        ]
      `);
    });

    it('ignores parser directives in wrong order', () => {
      const res = extractPackageFile(
        '# dummy\n# escape = `\n\nFROM\\\nnginx:1.20'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "1.20",
            "datasource": "docker",
            "depName": "nginx",
            "depType": "final",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  3,
                  4,
                ],
              ],
            },
            "replaceString": "nginx:1.20",
          },
        ]
      `);
    });

    it('handles an alternative escape character', () => {
      const res = extractPackageFile(d4).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "3.15.4",
            "datasource": "docker",
            "depName": "alpine",
            "depType": "stage",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  6,
                  7,
                ],
                Array [
                  2,
                  4,
                ],
              ],
            },
            "replaceString": "alpine:3.15.4",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": "sha256:abcdef",
            "currentValue": "18.04",
            "datasource": "docker",
            "depName": "nginx",
            "depType": "stage",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  15,
                  15,
                ],
                Array [
                  9,
                  13,
                ],
              ],
            },
            "replaceString": "nginx:18.04@sha256:abcdef",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "image5",
            "depType": "stage",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  17,
                  21,
                ],
              ],
            },
            "replaceString": "image5",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "image12",
            "depType": "final",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  23,
                  27,
                ],
              ],
            },
            "replaceString": "image12",
          },
        ]
      `);
    });

    it('handles FROM with version in ARG default value and quotes', () => {
      const res = extractPackageFile(
        'ARG REF_NAME=${REF_NAME:-"gcr.io/distroless/static-debian11:nonroot@sha256:abc"}\nfrom ${REF_NAME}'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": "sha256:abc",
            "currentValue": "nonroot",
            "datasource": "docker",
            "depName": "gcr.io/distroless/static-debian11",
            "depType": "final",
            "managerData": Object {
              "lineNumberRanges": Array [
                Array [
                  1,
                  1,
                ],
                Array [
                  0,
                  0,
                ],
              ],
            },
            "replaceString": "gcr.io/distroless/static-debian11:nonroot@sha256:abc",
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

      const res4 = getDep(
        '${REF_NAME:-"gcr.io/distroless/static-debian11:nonroot@sha256:abc"}'
      );
      expect(res4).toMatchInlineSnapshot(`
        Object {
          "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
          "currentDigest": "sha256:abc",
          "currentValue": "nonroot",
          "datasource": "docker",
          "depName": "gcr.io/distroless/static-debian11",
          "replaceString": "gcr.io/distroless/static-debian11:nonroot@sha256:abc",
        }
      `);

      const res5 = getDep(
        '${REF_NAME:+-gcr.io/distroless/static-debian11:nonroot@sha256:abc}'
      );
      expect(res5).toMatchInlineSnapshot(`
        Object {
          "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
          "datasource": "docker",
          "replaceString": "\${REF_NAME:+-gcr.io/distroless/static-debian11:nonroot@sha256:abc}",
          "skipReason": "contains-variable",
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
