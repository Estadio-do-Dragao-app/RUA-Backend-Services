#!/usr/bin/env bash
# =============================================================================
# generate_certs.sh — Self-signed PKI for Smart Stadium (dev/staging)
#
# Generates:
#   ca.crt / ca.key        → Root CA (shared trust anchor)
#   mosquitto.crt / .key   → Signed cert for MQTT broker
#   nginx.crt / .key       → Signed cert for Nginx HTTPS gateway
#
# Usage:
#   chmod +x docker-config/certs/generate_certs.sh
#   ./docker-config/certs/generate_certs.sh
#
# Output directory: docker-config/certs/
# =============================================================================

set -euo pipefail

CERTS_DIR="$(cd "$(dirname "$0")" && pwd)"
DAYS=3650   # 10 years – rotate before production
BITS=4096

echo "[CERTS] Generating self-signed PKI in: ${CERTS_DIR}"
mkdir -p "${CERTS_DIR}"

# ── 1. Root CA ────────────────────────────────────────────────────────────────
echo "[CERTS] 1/3 Generating Root CA..."
openssl genrsa -out "${CERTS_DIR}/ca.key" ${BITS}
openssl req -new -x509 \
  -days ${DAYS} \
  -key "${CERTS_DIR}/ca.key" \
  -out "${CERTS_DIR}/ca.crt" \
  -subj "/C=PT/ST=Porto/L=Porto/O=SmartStadium/CN=SmartStadium-RootCA"

# ── 2. Mosquitto MQTTS certificate ───────────────────────────────────────────
echo "[CERTS] 2/3 Generating Mosquitto certificate..."
openssl genrsa -out "${CERTS_DIR}/mosquitto.key" ${BITS}
openssl req -new \
  -key "${CERTS_DIR}/mosquitto.key" \
  -out "${CERTS_DIR}/mosquitto.csr" \
  -subj "/C=PT/ST=Porto/L=Porto/O=SmartStadium/CN=mosquitto"

# SAN extension — allows both internal Docker hostname and localhost
cat > "${CERTS_DIR}/mosquitto_ext.cnf" <<EOF
[req]
req_extensions = v3_req
[v3_req]
subjectAltName = @alt_names
[alt_names]
DNS.1 = mosquitto
DNS.2 = localhost
IP.1  = 127.0.0.1
EOF

openssl x509 -req \
  -days ${DAYS} \
  -in "${CERTS_DIR}/mosquitto.csr" \
  -CA "${CERTS_DIR}/ca.crt" \
  -CAkey "${CERTS_DIR}/ca.key" \
  -CAcreateserial \
  -out "${CERTS_DIR}/mosquitto.crt" \
  -extensions v3_req \
  -extfile "${CERTS_DIR}/mosquitto_ext.cnf"

# ── 3. Nginx HTTPS certificate ────────────────────────────────────────────────
echo "[CERTS] 3/3 Generating Nginx certificate..."
openssl genrsa -out "${CERTS_DIR}/nginx.key" ${BITS}
openssl req -new \
  -key "${CERTS_DIR}/nginx.key" \
  -out "${CERTS_DIR}/nginx.csr" \
  -subj "/C=PT/ST=Porto/L=Porto/O=SmartStadium/CN=nginx"

cat > "${CERTS_DIR}/nginx_ext.cnf" <<EOF
[req]
req_extensions = v3_req
[v3_req]
subjectAltName = @alt_names
[alt_names]
DNS.1 = nginx
DNS.2 = localhost
IP.1  = 127.0.0.1
EOF

openssl x509 -req \
  -days ${DAYS} \
  -in "${CERTS_DIR}/nginx.csr" \
  -CA "${CERTS_DIR}/ca.crt" \
  -CAkey "${CERTS_DIR}/ca.key" \
  -CAcreateserial \
  -out "${CERTS_DIR}/nginx.crt" \
  -extensions v3_req \
  -extfile "${CERTS_DIR}/nginx_ext.cnf"

# ── 4. MQTT Password file ─────────────────────────────────────────────────────
echo "[CERTS] Creating MQTT password file..."
PASSWD_FILE="${CERTS_DIR}/../mosquitto/passwd"
touch "${PASSWD_FILE}"

# Use local command if available, otherwise run via docker
if command -v mosquitto_passwd &> /dev/null; then
    mosquitto_passwd -c -b "${PASSWD_FILE}" services dragao_mqtt_2026
    mosquitto_passwd -b "${PASSWD_FILE}" fanapp dragao_fan_2026
else
    echo "[CERTS] mosquitto_passwd not found locally, running via Docker..."
    docker --context default run --rm -v "${PASSWD_FILE}:/passwd" eclipse-mosquitto:2.0 mosquitto_passwd -c -b /passwd services dragao_mqtt_2026
    docker --context default run --rm -v "${PASSWD_FILE}:/passwd" eclipse-mosquitto:2.0 mosquitto_passwd -b /passwd fanapp dragao_fan_2026
fi

# ── Cleanup intermediate files ────────────────────────────────────────────────
rm -f "${CERTS_DIR}"/*.csr "${CERTS_DIR}"/*_ext.cnf

echo ""
echo "✅  PKI generation complete!"
echo "    Root CA   → ${CERTS_DIR}/ca.crt"
echo "    Mosquitto → ${CERTS_DIR}/mosquitto.{crt,key}"
echo "    Nginx     → ${CERTS_DIR}/nginx.{crt,key}"
echo "    MQTT users: services / fanapp"
echo ""
echo "Next steps:"
echo "  1. Run: docker compose up --build -d"
echo "  2. Verify MQTTS: mosquitto_sub -h localhost -p 8883 --cafile docker-config/certs/ca.crt -u services -P dragao_mqtt_2026 -t '#'"
echo "  3. Verify HTTPS: curl -k -H 'X-API-Key: dragao_secret_key_2026' https://localhost/health"
