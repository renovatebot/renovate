#!/bin/bash

sudo systemctl stop docker
cat /etc/docker/daemon.json
echo '{ "cgroup-parent": "/actions_job", "data-root": "/mnt/docker" }' | sudo tee /etc/docker/daemon.json
sudo rm -rf /var/lib/docker
sudo mkdir -p /mnt/docker
sudo systemctl start docker || sudo journalctl -u docker.service
docker info
