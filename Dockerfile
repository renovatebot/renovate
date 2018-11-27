FROM amd64/golang:1.11.2-alpine@sha256:2169a7effa73e283ad0f290021eaf14fd812dae9767646b5afcb5bf097b17c0b AS golang

FROM amd64/node:8.13.0-alpine@sha256:7e600a56ff0a01f51434f47e2522107ea75919e1c5a210d1ca296c01994b95d9

LABEL maintainer="Rhys Arkins <rhys@arkins.net>"
LABEL name="renovate"

WORKDIR /usr/src/app/

RUN apk add --quiet --no-cache git openssh-client ca-certificates php php-mbstring php-openssl php-zip php-zlib composer
COPY package.json .
COPY yarn.lock .
RUN yarn install --production && yarn cache clean
COPY lib lib

COPY --from=golang /usr/local/go/bin/go /bin/go
RUN mkdir -p /usr/local/go

COPY bin bin

USER node

ENTRYPOINT ["node", "/usr/src/app/lib/renovate.js"]
CMD ["--help"]
