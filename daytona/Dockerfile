FROM node:20-slim

RUN apt-get update && apt-get install -y \
    git curl ca-certificates gnupg zip unzip procps \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g opencode-ai@latest

RUN mkdir -p /workspace
WORKDIR /workspace

CMD ["sleep", "infinity"]
