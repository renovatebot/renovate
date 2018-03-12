FROM node:8.10.0-alpine@sha256:06ebd9b1879057e24c1e87db508ba9fd0dd7f766bbf55665652d31487ca194eb

LABEL maintainer="Rhys Arkins <rhys@arkins.net>"
LABEL name="renovate"

WORKDIR /src

RUN apk --update add git openssh-client && \
    rm -rf /var/lib/apt/lists/* && \
    rm /var/cache/apk/*
COPY package.json .
COPY yarn.lock .
RUN yarn install --production && yarn cache clean
COPY lib ./lib
RUN chown -R node:node /src
USER node

ENTRYPOINT ["node", "/src/lib/renovate.js"]
CMD ["--help"]
