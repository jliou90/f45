FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY supervisor/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY supervisor /app/supervisor
COPY VERSION /app/VERSION

EXPOSE 7331

CMD ["python", "-m", "uvicorn", "supervisor.app.main:app", "--host", "0.0.0.0", "--port", "7331"]
