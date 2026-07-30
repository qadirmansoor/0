FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY config/ ./config/
COPY src/ ./src/

EXPOSE 8000

CMD ["python", "-m", "src.main", "--config", "config/config.yaml"]
