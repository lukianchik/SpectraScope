FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .

RUN addgroup --system spectrascope \
    && adduser --system --ingroup spectrascope --home /app spectrascope \
    && chown -R spectrascope:spectrascope /app

USER spectrascope

EXPOSE 8000
