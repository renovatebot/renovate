FROM gitpod/workspace-full

# Install Java OpenJDK

RUN bash -c ". /home/gitpod/.sdkman/bin/sdkman-init.sh && sdk update && sdk install java 11.0.12-open"

# Install Node.js and use it

RUN bash -c ". .nvm/nvm.sh && nvm install 14.18.1 && nvm use 14.18.1 && nvm alias default 14.18.1"

RUN echo "nvm use default &>/dev/null" >> ~/.bashrc.d/51-nvm-fix
