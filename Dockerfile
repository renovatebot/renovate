FROM node:lts-alpine@sha256:aa28f3b6b4087b3f289bebaca8d3fb82b93137ae739aa67df3a04892d521958e AS tsbuild

COPY package.json .
COPY yarn.lock .
RUN yarn install

COPY lib lib
COPY tsconfig.json tsconfig.json
COPY tsconfig.app.json tsconfig.app.json

RUN yarn build


FROM amd64/ubuntu:18.04@sha256:b36667c98cf8f68d4b7f1fb8e01f742c2ed26b5f0c965a788e98dfe589a4b3e4

LABEL maintainer="Rhys Arkins <rhys@arkins.net>"
LABEL name="renovate"
LABEL org.opencontainers.image.source="https://github.com/renovatebot/renovate"

WORKDIR /usr/src/app/

ENV DEBIAN_FRONTEND noninteractive
ENV LC_ALL C.UTF-8
ENV LANG C.UTF-8

RUN apt-get update && apt-get install -y gpg curl wget unzip xz-utils git openssh-client bsdtar && apt-get clean -y

## Gradle

RUN apt-get update && apt-get install -y --no-install-recommends openjdk-8-jdk gradle && apt-get clean -y

## Node.js

# START copy Node.js from https://github.com/nodejs/docker-node/blob/master/10/jessie/Dockerfile

ENV NODE_VERSION 10.15.1

RUN ARCH= && dpkgArch="$(dpkg --print-architecture)" \
  && case "${dpkgArch##*-}" in \
  amd64) ARCH='x64';; \
  ppc64el) ARCH='ppc64le';; \
  s390x) ARCH='s390x';; \
  arm64) ARCH='arm64';; \
  armhf) ARCH='armv7l';; \
  i386) ARCH='x86';; \
  *) echo "unsupported architecture"; exit 1 ;; \
  esac \
  # gpg keys listed at https://github.com/nodejs/node#release-keys
  && set -ex \
  && for key in \
  94AE36675C464D64BAFA68DD7434390BDBE9B9C5 \
  FD3A5288F042B6850C66B31F09FE44734EB7990E \
  71DCFD284A79C3B38668286BC97EC7A07EDE3FC1 \
  DD8F2338BAE7501E3DD5AC78C273792F7D83545D \
  C4F0DFFF4E8C1A8236409D08E73BC641CC11F4C8 \
  B9AE9905FFD7803F25714661B63B535A4C206CA9 \
  77984A986EBC2AA786BC0F66B01FBB92821C587A \
  8FCCA13FEF1D0C2E91008E09770F7A9A5AE15600 \
  4ED778F539E3634C779C87C6D7062848A1AB005C \
  A48C2BEE680E841632CD4E44F07496B3EB3C1762 \
  B9E2F5981AA6E0CD28160D9FF13993A75599653C \
  ; do \
  gpg --batch --keyserver hkp://p80.pool.sks-keyservers.net:80 --recv-keys "$key" || \
  gpg --batch --keyserver hkp://ipv4.pool.sks-keyservers.net --recv-keys "$key" || \
  gpg --batch --keyserver hkp://pgp.mit.edu:80 --recv-keys "$key" ; \
  done \
  && curl -fsSLO --compressed "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-$ARCH.tar.xz" \
  && curl -fsSLO --compressed "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt.asc" \
  && gpg --batch --decrypt --output SHASUMS256.txt SHASUMS256.txt.asc \
  && grep " node-v$NODE_VERSION-linux-$ARCH.tar.xz\$" SHASUMS256.txt | sha256sum -c - \
  && bsdtar -xJf "node-v$NODE_VERSION-linux-$ARCH.tar.xz" -C /usr/local --strip-components=1 --no-same-owner \
  && rm "node-v$NODE_VERSION-linux-$ARCH.tar.xz" SHASUMS256.txt.asc SHASUMS256.txt \
  && ln -s /usr/local/bin/node /usr/local/bin/nodejs

## END copy Node.js

# PHP Composer

RUN apt-get update && apt-get install -y php-cli php-mbstring && apt-get clean

ENV COMPOSER_VERSION=1.7.2

RUN php -r "copy('https://github.com/composer/composer/releases/download/$COMPOSER_VERSION/composer.phar', '/usr/local/bin/composer');"

RUN chmod +x /usr/local/bin/composer

# Go Modules

RUN apt-get update && apt-get install -y bzr && apt-get clean

ENV GOLANG_VERSION 1.12

RUN wget -q -O go.tgz "https://golang.org/dl/go${GOLANG_VERSION}.linux-amd64.tar.gz" && \
  tar -C /usr/local -xzf go.tgz && \
  rm go.tgz && \
  export PATH="/usr/local/go/bin:$PATH"

ENV GOPATH /go
ENV PATH $GOPATH/bin:/usr/local/go/bin:$PATH

RUN mkdir -p "$GOPATH/src" "$GOPATH/bin" && chmod -R 777 "$GOPATH"

ENV CGO_ENABLED=0

# Python

RUN apt-get update && apt-get install -y python3.7-dev python3-distutils && apt-get clean

RUN rm -fr /usr/bin/python3 && ln /usr/bin/python3.7 /usr/bin/python3
RUN rm -rf /usr/bin/python && ln /usr/bin/python3.7 /usr/bin/python

# Pip

RUN curl --silent https://bootstrap.pypa.io/get-pip.py | python

# Set up ubuntu user

RUN groupadd --gid 1000 ubuntu \
  && useradd --uid 1000 --gid ubuntu --shell /bin/bash --create-home ubuntu

RUN chmod -R a+rw /usr

# Docker client and group

RUN groupadd -g 999 docker
RUN usermod -aG docker ubuntu

ENV DOCKER_VERSION=18.09.2

RUN curl -fsSLO https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_VERSION}.tgz \
  && tar xzvf docker-${DOCKER_VERSION}.tgz --strip 1 \
  -C /usr/local/bin docker/docker \
  && rm docker-${DOCKER_VERSION}.tgz

USER ubuntu

# Pipenv

ENV PATH="/home/ubuntu/.local/bin:$PATH"

RUN pip install --user pipenv

# Poetry

RUN curl -sSL https://raw.githubusercontent.com/sdispater/poetry/master/get-poetry.py | python

ENV PATH="/home/ubuntu/.poetry/bin:$PATH"
RUN poetry config settings.virtualenvs.create false

# npm

ENV NPM_VERSION=6.9.0

RUN npm install -g npm@$NPM_VERSION

# Yarn

ENV YARN_VERSION=1.15.2

RUN curl -o- -L https://yarnpkg.com/install.sh | bash -s -- --version ${YARN_VERSION}

ENV PATH="/home/ubuntu/.yarn/bin:/home/ubuntu/.config/yarn/global/node_modules/.bin:$PATH"

COPY package.json .
COPY yarn.lock .
RUN yarn install --production && yarn cache clean
COPY --from=tsbuild dist dist
COPY bin bin
COPY data data

ENTRYPOINT ["node", "/usr/src/app/dist/renovate.js"]
CMD []
