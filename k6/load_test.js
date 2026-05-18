import http from 'k6/http';
import { check, sleep } from 'k6';

// Run with: docker compose -f docker-compose.yml.vm --profile testing run k6
// Or override: k6 run --vus 10 --duration 60s /scripts/load_test.js
// Target: RUA - University of Aveiro Routing App

export const options = {
  // Make VU target and hold duration configurable via env vars:
  // - K6_VUS (number) sets the target virtual users
  // - K6_DURATION (string) sets the hold duration (e.g. '1m', '2m')
  // Defaults: 10 VUs, 1m hold
  stages: (function () {
    const target = __ENV.K6_VUS ? parseInt(__ENV.K6_VUS, 10) : 10;
    const hold = __ENV.K6_DURATION || '1m';
    return [
      { duration: '30s', target: target },
      { duration: hold,      target: target },
      { duration: '30s', target: 0 },
    ];
  })(),
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed:   ['rate<0.05'],  // error rate under 5%
  },
};

const BASE_WAITTIME   = 'http://waittime-service:8001';
const BASE_CONGESTION = 'http://congestion-service:8000';
const BASE_ROUTING    = 'http://routing-service:8002';
const BASE_MAP        = 'http://mapservice:8000';

export default function () {
  // --- WaitTime-Service ---
  let res = http.get(`${BASE_WAITTIME}/health`);
  check(res, { 'waittime /health 200': (r) => r.status === 200 });

  res = http.get(`${BASE_WAITTIME}/api/pois`);
  check(res, { 'waittime /api/pois 200': (r) => r.status === 200 });

  res = http.get(`${BASE_WAITTIME}/api/waittime/all`);
  check(res, { 'waittime /api/waittime/all 200': (r) => r.status === 200 });

  // --- Congestion-Service ---
  res = http.get(`${BASE_CONGESTION}/health`);
  check(res, { 'congestion /health 200': (r) => r.status === 200 });

  res = http.get(`${BASE_CONGESTION}/sections`);
  check(res, { 'congestion /sections 200': (r) => r.status === 200 });

  res = http.get(`${BASE_CONGESTION}/heatmap/stadium/cells`);
  check(res, { 'congestion /heatmap 200': (r) => r.status === 200 });

  // --- Routing-Service ---
  res = http.get(`${BASE_ROUTING}/health`);
  check(res, { 'routing /health 200': (r) => r.status === 200 });

  // --- Map-Service ---
  res = http.get(`${BASE_MAP}/health`);
  check(res, { 'map /health 200': (r) => r.status === 200 });

  sleep(1);
}
