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

# The official uv binary installs the locked dependencies into /app/.venv,
# using the image's own Python rather than downloading one.
COPY --from=ghcr.io/astral-sh/uv:0.11.32 /uv /uvx /bin/
ENV UV_PYTHON_DOWNLOADS=never \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN uv sync --frozen --no-dev

# Copy backend source
COPY backend/ ./

# Copy built frontend from build stage
COPY --from=frontend-build /app/frontend/dist ./static

# yt-dlp is installed last, unpinned, in its own layer. It releases far more
# often than the rest of the stack, so every rebuild picks up the current
# version instead of whatever uv.lock holds. Pass an exact version to
# reproduce an old build:
#   docker build --build-arg YTDLP_VERSION=2026.8.19 .
# The default extra pins the yt-dlp-ejs release that matches yt-dlp, and the
# deno extra installs Deno, the JavaScript runtime yt-dlp enables by default.
# The server runs with plain python from the venv, not uv run, which would
# re-sync the venv back to uv.lock.
ARG YTDLP_VERSION=latest
RUN if [ "$YTDLP_VERSION" = "latest" ]; then \
        uv pip install --no-cache --python /app/.venv/bin/python --upgrade "yt-dlp[default,deno]"; \
    else \
        uv pip install --no-cache --python /app/.venv/bin/python "yt-dlp[default,deno]==$YTDLP_VERSION"; \
    fi \
    && yt-dlp --version \
    && deno --version

# Set YTDLP_AUTO_UPDATE=1 to also refresh yt-dlp on every container start,
# which keeps a long-lived deployment current without an image rebuild.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Expose port
EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Start the server
CMD ["python", "main.py"]