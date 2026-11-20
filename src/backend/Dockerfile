
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install backend dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create a non-root user
RUN groupadd --gid 10001 app && \
    useradd --uid 10001 --gid app --create-home app

# Copy Django application
COPY --chown=app:app . .

USER app

EXPOSE 8000

# Run Django through ASGI
CMD ["uvicorn", "config.asgi:application", "--host", "0.0.0.0", "--port", "8000"]
