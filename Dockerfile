FROM node:8.11.0-alpine@sha256:8af2ad09cdf0cc443ce076971e0c5b593c0fc7250d1fca3afe67fc7a8ff08a21

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
