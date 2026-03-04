FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app/backend

COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY VERSION /app/VERSION
COPY backend /app/backend

EXPOSE 8010

CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port 8010 --workers ${UVICORN_WORKERS:-4}"]
