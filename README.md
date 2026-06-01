# RUA - Backend Services (Dragão-App)

Welcome to the backend orchestration repository for the Dragão-app (Estádio do Dragão). This repository contains a microservices architecture designed to handle stadium events, map processing, routing, wait times, congestion tracking, alerts, and computer vision inputs.

## 🏗 Repository Structure & Services

This project relies on a unified Docker Compose setup to orchestrate several interconnected microservices and infrastructure components:

- **Mosquitto (MQTT Broker)**: Unified message broker handling communications for stadium events and client services securely via TLS/WSS.
- **Map-Service**: Provides API capabilities and spatial data processing, backed by a PostgreSQL database. It includes a frontend dashboard for visual map management.
- **Input-Processor**: YOLOv8 Edge Computer Vision services to process camera feeds and GPS data.
- **WaitTime-Service**: Tracks and estimates queue wait times using a dedicated PostgreSQL database and downstream/upstream MQTT queues.
- **Congestion-Service**: Analyzes and broadcasts stadium congestion levels.
- **Alert-Service**: Handles real-time system and stadium alerts for clients.
- **Routing-Service-Fanapp**: Centralized routing service aggregating data from the Map, WaitTime, and Congestion services to provide pathfinding logic to the frontend app.
- **Nginx Gateway**: A reverse proxy serving as the secure entry point (HTTPS) for API services.
- **Monitoring Stack**: Prometheus, Grafana, and Blackbox Exporter to monitor service health and performance.

---

## 🚀 Deployment Instructions

Follow these steps to configure and deploy the backend environment locally or on a server.

### 1. Prerequisites
- [Docker](https://docs.docker.com/get-docker/) installed.
- [Docker Compose](https://docs.docker.com/compose/install/) installed.

### 2. Environment Variables (`.env`)
Before starting the services, you must define the environment variables required for databases, security keys, and MQTT brokers.

1. In the root of the project, copy the provided `.env.example` file to create a new `.env` file:
   ```bash
   cp .env.example .env
   ```

2. Open the `.env` file and configure your secure values. For example:
   ```env
   # Map-Service database
   MAP_DB_USER=postgres
   MAP_DB_PASSWORD=your_secure_map_db_password
   MAP_DB_NAME=rua_map
   
   # WaitTime-Service database
   WAITTIME_DB_USER=postgres
   WAITTIME_DB_PASSWORD=your_secure_waittime_db_password
   WAITTIME_DB_NAME=rua_waittime
   
   # MQTT broker credentials
   MQTT_USER=services
   MQTT_PASS=your_secure_mqtt_password
   
   # Shared application key
   API_KEY=your_secure_api_key
   ```
   *(Note: Ensure you replace placeholder values like `replace-with-a-real-mqtt-password` with actual secure strings before deploying to production).*

### 3. Build and Run

To launch the entire infrastructure, run the following command in the project root:

```bash
docker compose up -d --build
```
This command will build the necessary images from source (e.g., Map, Input Processor, WaitTime, etc.) and start all containers in detached mode. 

To view the logs of all running services:
```bash
docker compose logs -f
```

To shut down the infrastructure:
```bash
docker compose down
```

*(Note: To run optional load testing scripts, you can run `docker compose --profile testing up -d k6`)*

## 🔐 TLS & Certificates
The project utilizes a `docker-config` directory to map configurations and secure certificates (`ca.crt`, etc.) into the Mosquitto broker, Nginx reverse proxy, and various Python services to ensure all MQTT and HTTP traffic is fully encrypted. Ensure your certificates are correctly placed in `./docker-config/certs/` for production deployments.
