FROM node:20-slim

# Install base tools and Chromium dependencies for Remotion/Puppeteer
RUN apt-get update && apt-get install -y \
    git curl ca-certificates gnupg zip unzip procps \
    # Chromium dependencies
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    # Additional libs for video processing
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install OpenCode CLI
RUN npm install -g opencode-ai@latest

# Install chrome-headless-shell for Remotion/Puppeteer
RUN npx @puppeteer/browsers install chrome-headless-shell@stable \
    && ln -s /root/.cache/puppeteer/chrome-headless-shell-*/chrome-headless-shell-*/chrome-headless-shell /usr/local/bin/chrome-headless-shell

RUN mkdir -p /workspace
WORKDIR /workspace

CMD ["sleep", "infinity"]
