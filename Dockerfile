# --- Build frontend ---
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Production ---
FROM python:3.12-slim
WORKDIR /app

# Install Python deps
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Data directory for SQLite persistence
RUN mkdir -p /data
ENV DATABASE_URL="sqlite:////data/prediction_market.db"

ENV PORT=8000
EXPOSE ${PORT}

CMD uvicorn backend.main:app --host 0.0.0.0 --port $PORT
