FROM node:8.11.0-alpine@sha256:fa3766ad0159e71ccb8970b00c1f2bfc354e22e2c26aa7a144605c600e4fda71

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
