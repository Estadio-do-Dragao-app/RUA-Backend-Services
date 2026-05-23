import http from 'k6/http';
import { check, sleep, group } from 'k6';

// Run with: docker compose -f docker-compose.yml.vm --profile testing run k6
// Or override: k6 run --vus 10 --duration 60s k6/load_test.js

export const options = {
  // Keep compatibility with existing env-driven staging while providing a larger default profile
  stages: (function () {
    if (__ENV.K6_VUS || __ENV.K6_DURATION) {
      const target = __ENV.K6_VUS ? parseInt(__ENV.K6_VUS, 10) : 10;
      const hold = __ENV.K6_DURATION || '1m';
      return [
        { duration: '30s', target: target },
        { duration: hold, target: target },
        { duration: '30s', target: 0 },
      ];
    }
    return [
      { duration: '30s', target: 10 },
      { duration: '3m',  target: 20 },
      { duration: '2m',  target: 50 },
      { duration: '1m',  target: 0  },
    ];
  })(),
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed:   ['rate<0.1'],
  },
};

const BASE_WAITTIME   = 'http://waittime-service:8001';
const BASE_CONGESTION = 'http://congestion-service:8000';
const BASE_ROUTING    = 'http://routing-service:8002';
const BASE_MAP        = 'http://mapservice:8000';

const API_KEY = __ENV.API_KEY || 'dragao_secret_key_2026';
const JSON_HEADERS = { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' };

export default function () {
  // WaitTime Service scenarios
  group('WaitTime-Service', function () {
    let res = http.get(`${BASE_WAITTIME}/health`);
    check(res, { 'waittime /health 200': (r) => r.status === 200 });

    res = http.get(`${BASE_WAITTIME}/api/pois`, { headers: JSON_HEADERS });
    check(res, { 'waittime /api/pois ok': (r) => r.status === 200 });

    // If we got POIs, exercise POI detail and specific waittime lookup
    try {
      const pois = res.json();
      if (Array.isArray(pois) && pois.length > 0) {
        const pid = pois[0].id || pois[0].poi_id || pois[0].id;
        if (pid) {
          let r2 = http.get(`${BASE_WAITTIME}/api/poi/${encodeURIComponent(pid)}`, { headers: JSON_HEADERS });
          check(r2, { 'waittime /api/poi detail': (r) => r.status === 200 || r.status === 404 });

          let r3 = http.get(`${BASE_WAITTIME}/api/waittime?poi=${encodeURIComponent(pid)}`, { headers: JSON_HEADERS });
          check(r3, { 'waittime /api/waittime single': (r) => r.status === 200 || r.status === 404 });
        }
      }
    } catch (e) {}

    // POST privacy consent (no auth expected)
    let consent = { user_id: 'loadtest-user', action: 'granted' };
    let rc = http.post(`${BASE_WAITTIME}/api/v1/privacy/consent`, JSON.stringify(consent), { headers: { 'Content-Type': 'application/json' } });
    check(rc, { 'waittime consent logged': (r) => r.status === 200 || r.status === 201 });
  });

  // Congestion Service scenarios
  group('Congestion-Service', function () {
    let res = http.get(`${BASE_CONGESTION}/health`);
    check(res, { 'congestion /health 200': (r) => r.status === 200 });

    // Authenticated endpoints - include API key
    res = http.get(`${BASE_CONGESTION}/heatmap/stadium/cells`, { headers: JSON_HEADERS });
    check(res, { 'congestion /heatmap 200': (r) => r.status === 200 || r.status === 404 });

    try {
      const body = res.json();
      const cells = body && body.cells ? body.cells : (Array.isArray(body) ? body : []);
      if (Array.isArray(cells) && cells.length > 0) {
        const cell = cells[0];
        const cid = cell.cell_id || cell.id;
        if (cid) {
          let r2 = http.get(`${BASE_CONGESTION}/heatmap/cell/${encodeURIComponent(cid)}`, { headers: JSON_HEADERS });
          check(r2, { 'congestion /heatmap cell': (r) => r.status === 200 || r.status === 404 });
        }
      }
    } catch (e) {}

    let rsec = http.get(`${BASE_CONGESTION}/sections`, { headers: JSON_HEADERS });
    check(rsec, { 'congestion /sections 200': (r) => r.status === 200 });
  });

  // Routing Service scenarios
  group('Routing-Service', function () {
    let res = http.get(`${BASE_ROUTING}/health`);
    check(res, { 'routing /health 200': (r) => r.status === 200 });

    // Parameterized route calculation (may return 200 or a well-formed 4xx)
    const routeReq = {
      start: { x: 0.0, y: 0.0, level: 0 },
      destination_type: 'nearest_category',
      destination_id: 'restroom',
      avoid_stairs: false
    };

    let r = http.post(`${BASE_ROUTING}/api/route`, JSON.stringify(routeReq), { headers: JSON_HEADERS });
    check(r, { 'routing /api/route no 5xx': (res) => res.status < 500 });

    // Trigger an alert (authenticated)
    const alert = { alert_type: 'TEST', severity: 2, message: 'k6 load test', affected_areas: [] };
    let ra = http.post(`${BASE_ROUTING}/api/alerts`, JSON.stringify(alert), { headers: JSON_HEADERS });
    check(ra, { 'routing /api/alerts accepted': (res) => res.status === 200 || res.status === 202 || res.status === 401 });
  });

  // Map Service scenarios
  group('Map-Service', function () {
    let res = http.get(`${BASE_MAP}/map`);
    check(res, { 'map /map 200': (r) => r.status === 200 });

    try {
      const map = res.json();
      const nodes = map && map.nodes ? map.nodes : [];
      if (Array.isArray(nodes) && nodes.length > 0) {
        const nodeId = nodes[0].id;
        if (nodeId) {
          let rn = http.get(`${BASE_MAP}/nodes/${encodeURIComponent(nodeId)}`);
          check(rn, { 'map /nodes/{id} ok': (r) => r.status === 200 || r.status === 404 });
        }
      }
    } catch (e) {}
  });

  sleep(1);
}
