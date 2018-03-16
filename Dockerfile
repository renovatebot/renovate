FROM node:8.10.0-alpine@sha256:a1e4bb2dd67cbe5e998645afd77c2f28d6dd5073908066a6f4670f502a814b7b

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
