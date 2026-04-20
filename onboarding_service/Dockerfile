FROM python:3.10-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

COPY onboarding_service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# We only copy the onboarding_service folder for this microservice container
COPY onboarding_service/ ./onboarding_service/

EXPOSE 8081

# Run the FastAPI app
CMD ["uvicorn", "onboarding_service.main:app", "--host", "0.0.0.0", "--port", "8081"]
