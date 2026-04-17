FROM python:3.10-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt
RUN pip install gunicorn uvicorn psycopg2-binary

COPY . .

# Collect static files (needs dummy env vars for Django settings)
RUN SECRET_KEY=dummy python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["gunicorn", "shin_beginning.asgi:application", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
