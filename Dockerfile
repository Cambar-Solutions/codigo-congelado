FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_PORT=4007

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY server.py .
COPY static ./static

EXPOSE 4007

CMD gunicorn --bind 0.0.0.0:${APP_PORT} --workers 2 --timeout 60 server:app
