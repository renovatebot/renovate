FROM node:8.11.1-alpine@sha256:1b1928c9eea9e6cd5ff6155a2adda33a022a08911a1418f5ebe8ff992abd2a69

LABEL maintainer="Rhys Arkins <rhys@arkins.net>"
LABEL name="renovate"

WORKDIR /usr/src/app/

RUN apk add --quiet --no-cache git openssh-client
COPY package.json .
COPY yarn.lock .
RUN yarn install --production && yarn cache clean
COPY lib lib
USER node

ENTRYPOINT ["node", "/usr/src/app/lib/renovate.js"]
CMD ["--help"]
