# Build stage - Frontend
FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci --only=production

# Copy frontend source
COPY frontend/ ./

# Build frontend for production
RUN npm run build

# Production stage - Backend
FROM python:3.12-slim

WORKDIR /app

# Copy backend requirements and install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./

# Copy built frontend from build stage
COPY --from=frontend-build /app/frontend/dist ./static

# Expose port
EXPOSE 8000

# Start the server
CMD ["python", "main.py"]