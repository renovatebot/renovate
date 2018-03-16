FROM node:8.10.0-alpine@sha256:3d8c9bfbc127446df65d6d59e85754f5f53b51c09b30e80896a0f2c4918fba77

LABEL maintainer="Rhys Arkins <rhys@arkins.net>"
LABEL name="renovate"

WORKDIR /src

RUN apk add --quiet --no-cache git openssh-client
COPY package.json .
COPY yarn.lock .
RUN yarn install --production && yarn cache clean
COPY lib ./lib
RUN chown -R node:node /src
USER node

ENTRYPOINT ["node", "/src/lib/renovate.js"]
CMD ["--help"]
