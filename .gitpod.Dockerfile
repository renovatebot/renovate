FROM gitpod/workspace-full

# Install latest version of Git

RUN sudo apt-get update && sudo apt-get install -y \
    git \
    && sudo rm -rf /var/lib/apt/lists/*

# Install Java OpenJDK

RUN bash -c ". /home/gitpod/.sdkman/bin/sdkman-init.sh && sdk update && sdk install java 11.0.12-open"

# Install Node.js and use it

RUN bash -c ". .nvm/nvm.sh && nvm install 14.18.1 && nvm use 14.18.1 && nvm alias default 14.18.1"

RUN echo "nvm use default &>/dev/null" >> ~/.bashrc.d/51-nvm-fix

# Install Python

RUN bash -c "pyenv update && pyenv install 3.9.7 && pyenv global 3.9.7"
