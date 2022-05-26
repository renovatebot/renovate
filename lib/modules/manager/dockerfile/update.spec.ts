import type { UpdateType } from '../../../config/types';
import { updateDependency } from './update';

describe('modules/manager/dockerfile/update', () => {
  describe('updateDependency()', () => {
    it('updates version and digest in FROM', () => {
      const content =
        'FROM node:8.11.3-alpine@sha256:d743b4141b02fcfb8beb68f92b4cd164f60ee457bf2d053f36785bf86de16b0d AS node';
      const upgrade = {
        currentDigest:
          'sha256:d743b4141b02fcfb8beb68f92b4cd164f60ee457bf2d053f36785bf86de16b0d',
        currentValue: '8.11.3-alpine',
        depName: 'node',
        managerData: { lineNumberRanges: [[0, 0]] },
        newDigest: 'sha256:aaaaa',
        newValue: '8.11.4-alpine',
      };
      const res = updateDependency({ fileContent: content, upgrade });
      expect(res).toBe('FROM node:8.11.4-alpine@sha256:aaaaa AS node');
    });

    it('updates only version in FROM', () => {
      const content = 'FROM ubuntu:14.04 as ubuntu\n';
      const upgrade = {
        currentValue: '14.04',
        depName: 'ubuntu',
        managerData: { lineNumberRanges: [[0, 0]] },
        newValue: '22.04',
        updateType: 'major' as UpdateType,
      };
      const res = updateDependency({ fileContent: content, upgrade });
      expect(res).toBe('FROM ubuntu:22.04 as ubuntu\n');
    });

    it('updates version in ARG with CRLF linefeed', () => {
      const content = 'ARG IMAGE_TAG=14.04\r\nFROM ubuntu:$IMAGE_TAG\r\n';
      const upgrade = {
        currentValue: '14.04',
        depName: 'ubuntu',
        managerData: {
          lineNumberRanges: [
            [0, 0],
            [1, 1],
          ],
        },
        newValue: '22.04',
        updateType: 'major' as UpdateType,
      };
      const res = updateDependency({ fileContent: content, upgrade });
      expect(res).toBe('ARG IMAGE_TAG=22.04\r\nFROM ubuntu:$IMAGE_TAG\r\n');
    });

    it('updates digest in ARG value', () => {
      const content =
        'ARG sha_digest=sha256:ab37242e81cbc031b2600eef4440fe87055a05c14b40686df85078cc5086c98f\n' +
        '      FROM gcr.io/distroless/java17@$sha_digest';
      const content_updated =
        'ARG sha_digest=sha256:95cf3ff248d90ee913df9bb6f29fb6a6c2e39a6a69662a03603e523f639aeed5\n' +
        '      FROM gcr.io/distroless/java17@$sha_digest';
      const upgrade = {
        currentDigest:
          'sha256:ab37242e81cbc031b2600eef4440fe87055a05c14b40686df85078cc5086c98f',
        depName: 'gcr.io/distroless/java17',
        managerData: {
          lineNumberRanges: [
            [0, 0],
            [1, 1],
          ],
        },
        newDigest:
          'sha256:95cf3ff248d90ee913df9bb6f29fb6a6c2e39a6a69662a03603e523f639aeed5',
      };
      const res = updateDependency({ fileContent: content, upgrade });
      expect(res).toBe(content_updated);
    });

    it('updates digest in ARG default value', () => {
      const content =
        'ARG REF_NAME=${REF_NAME:-"gcr.io/distroless/static-debian11:nonroot@sha256:bca3c203cdb36f5914ab8568e4c25165643ea9b711b41a8a58b42c80a51ed609"}\n' +
        'FROM ${REF_NAME} as base';
      const content_updated =
        'ARG REF_NAME=${REF_NAME:-"gcr.io/distroless/static-debian11:nonroot@sha256:2556293984c5738fc75208cce52cf0a4762c709cf38e4bf8def65a61992da0ad"}\n' +
        'FROM ${REF_NAME} as base';
      const upgrade = {
        currentDigest:
          'sha256:bca3c203cdb36f5914ab8568e4c25165643ea9b711b41a8a58b42c80a51ed609',
        depName: 'gcr.io/distroless/static-debian11',
        managerData: {
          lineNumberRanges: [
            [0, 0],
            [1, 1],
          ],
        },
        newDigest:
          'sha256:2556293984c5738fc75208cce52cf0a4762c709cf38e4bf8def65a61992da0ad',
      };
      const res = updateDependency({ fileContent: content, upgrade });
      expect(res).toBe(content_updated);
    });

    it('updates version and digest in one ARG value', () => {
      const content =
        'ARG ver_hash="8.11.3-alpine@sha256:d743b4141b02fcfb8beb68f92b4cd164f60ee457bf2d053f36785bf86de16b0d"\n' +
        'FROM node:${ver_hash:-14.19-stretch-slim}';
      const content_updated =
        'ARG ver_hash="18.2.0-alpine@sha256:0677e437543d10f6cb050d92c792a14e5eb84340e3d5b4c25a88baa723d8a4ae"\n' +
        'FROM node:${ver_hash:-14.19-stretch-slim}';
      const upgrade = {
        currentDigest:
          'sha256:d743b4141b02fcfb8beb68f92b4cd164f60ee457bf2d053f36785bf86de16b0d',
        currentValue: '8.11.3-alpine',
        depName: 'node',
        managerData: {
          lineNumberRanges: [
            [0, 0],
            [1, 1],
          ],
        },
        newDigest:
          'sha256:0677e437543d10f6cb050d92c792a14e5eb84340e3d5b4c25a88baa723d8a4ae',
        newValue: '18.2.0-alpine',
      };
      const res = updateDependency({ fileContent: content, upgrade });
      expect(res).toBe(content_updated);
    });

    it('updates multiple ARG values', () => {
      const content =
        '# random comment\n\n' +
        'ARG NODE_IMAGE_HASH="@sha256:ba9c961513b853210ae0ca1524274eafa5fd94e20b856343887ca7274c8450e4"\n' +
        'ARG NODE_IMAGE_HOST="docker.io/library/"\n' +
        'ARG NODE_IMAGE_NAME=node\n' +
        'ARG NODE_IMAGE_TAG="16.14.2-alpine3.14"\n' +
        'ARG DUMMY_PREFIX=\n' +
        'FROM ${DUMMY_PREFIX}${NODE_IMAGE_HOST}${NODE_IMAGE_NAME}:${NODE_IMAGE_TAG}${NODE_IMAGE_HASH} as yarn\n';
      const content_updated =
        '# random comment\n\n' +
        'ARG NODE_IMAGE_HASH="@sha256:53a5c087654e75f8b12475fe143c5ab8b5f33254a37dc87743d066a57e67b4de"\n' +
        'ARG NODE_IMAGE_HOST="docker.io/library/"\n' +
        'ARG NODE_IMAGE_NAME=node\n' +
        'ARG NODE_IMAGE_TAG="16.15.0-alpine3.14"\n' +
        'ARG DUMMY_PREFIX=\n' +
        'FROM ${DUMMY_PREFIX}${NODE_IMAGE_HOST}${NODE_IMAGE_NAME}:${NODE_IMAGE_TAG}${NODE_IMAGE_HASH} as yarn\n';
      const upgrade = {
        currentDigest:
          'sha256:ba9c961513b853210ae0ca1524274eafa5fd94e20b856343887ca7274c8450e4',
        currentValue: '16.14.2-alpine3.14',
        depName: 'docker.io/library/node',
        managerData: {
          lineNumberRanges: [
            [7, 7],
            [6, 6],
            [3, 3],
            [4, 4],
            [5, 5],
            [2, 2],
          ],
        },
        newDigest:
          'sha256:53a5c087654e75f8b12475fe143c5ab8b5f33254a37dc87743d066a57e67b4de',
        newValue: '16.15.0-alpine3.14',
      };
      const res = updateDependency({ fileContent: content, upgrade });
      expect(res).toBe(content_updated);
    });

    it('replaces depName if newName is provided', () => {
      const content = 'FROM bitnami/redis:6.2\n';
      const upgrade = {
        currentValue: '6.2',
        depName: 'bitnami/redis',
        managerData: { lineNumberRanges: [[0, 0]] },
        newName: 'mcr.microsoft.com/oss/bitnami/redis',
        newValue: '6.0.8',
        updateType: 'replacement' as UpdateType,
      };
      const res = updateDependency({ fileContent: content, upgrade });
      expect(res).toBe('FROM mcr.microsoft.com/oss/bitnami/redis:6.0.8\n');
    });

    it('ignores depName replacement if already updated', () => {
      const content = 'FROM library/ubuntu:20.04\n';
      const upgrade = {
        depName: 'library/alpine',
        managerData: { lineNumberRanges: [[0, 0]] },
        newName: 'library/ubuntu',
        updateType: 'replacement' as UpdateType,
      };
      const res = updateDependency({ fileContent: content, upgrade });
      expect(res).toBe(content);
    });

    it('updates version in multi-line ARG and FROM scenarios', () => {
      const content =
        'ARG \\\n' +
        '\t# multi-line arg\n' +
        '   ALPINE_VERSION=alpine:3.15.4\n\n' +
        'FROM \\\n' +
        '${ALPINE_VERSION} as stage1';
      const content_updated =
        'ARG \\\n' +
        '\t# multi-line arg\n' +
        '   ALPINE_VERSION=alpine:3.16.0\n\n' +
        'FROM \\\n' +
        '${ALPINE_VERSION} as stage1';
      const upgrade = {
        currentValue: '3.15.4',
        depName: 'alpine',
        managerData: {
          lineNumberRanges: [
            [4, 5],
            [0, 2],
          ],
        },
        newValue: '3.16.0',
      };
      const res = updateDependency({ fileContent: content, upgrade });
      expect(res).toBe(content_updated);
    });
  });
});
