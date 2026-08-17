# Build stage - Frontend
FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend for production
RUN npm run build

# Production stage - Backend
FROM python:3.12-slim

WORKDIR /app

# Install Bun (required by yt-dlp for JS runtime)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    unzip \
    && curl -fsSL https://bun.sh/install | bash \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

ENV PATH="/root/.bun/bin:$PATH"

# Copy backend requirements and install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./

# Copy built frontend from build stage
COPY --from=frontend-build /app/frontend/dist ./static

# yt-dlp is installed last, unpinned, in its own layer. It releases far more
# often than the rest of the stack, so every rebuild picks up the current
# version instead of whatever was pinned months ago. Pass an exact version to
# reproduce an old build:
#   docker build --build-arg YTDLP_VERSION=2025.12.8 .
ARG YTDLP_VERSION=latest
RUN if [ "$YTDLP_VERSION" = "latest" ]; then \
        pip install --no-cache-dir --upgrade yt-dlp yt-dlp-ejs; \
    else \
        pip install --no-cache-dir "yt-dlp==$YTDLP_VERSION" yt-dlp-ejs; \
    fi \
    && yt-dlp --version

# Set YTDLP_AUTO_UPDATE=1 to also refresh yt-dlp on every container start,
# which keeps a long-lived deployment current without an image rebuild.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Expose port
EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Start the server
CMD ["python", "main.py"]