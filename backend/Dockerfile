FROM ubuntu:22.04

WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js, Python 3.10, FFmpeg, VAAPI drivers, and other dependencies
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    python3-pip \
    ffmpeg \
    libva-dev \
    vainfo \
    mesa-va-drivers \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Ensure yt-dlp uses the correct Python version
RUN ln -sf /usr/bin/python3 /usr/bin/python

COPY package.json package-lock.json ./
RUN npm install

COPY . .

EXPOSE 5152

CMD ["npm", "start"]
