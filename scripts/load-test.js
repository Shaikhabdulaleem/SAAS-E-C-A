// k6 load test — run with: k6 run scripts/load-test.js
// Install k6: https://grafana.com/docs/k6/latest/set-up/install-k6/

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.API_URL || 'http://localhost:3001/api';

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // ramp up to 20 users
    { duration: '1m',  target: 50 },   // ramp up to 50 users
    { duration: '2m',  target: 50 },   // stay at 50
    { duration: '30s', target: 100 },  // spike to 100
    { duration: '1m',  target: 100 },  // stay at 100
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],   // 95th < 500ms, 99th < 1.5s
    http_req_failed: ['rate<0.05'],                    // <5% errors
  },
};

export default function () {
  // Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health status 200': (r) => r.status === 200,
    'health responds < 200ms': (r) => r.timings.duration < 200,
  });

  // Login attempt (will fail without real creds, but tests auth throughput)
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: 'loadtest@example.com', password: 'loadtest123' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(loginRes, {
    'login responds < 500ms': (r) => r.timings.duration < 500,
    'login returns JSON': (r) => r.headers['Content-Type']?.includes('application/json'),
  });

  // Dashboard (unauthenticated — will 401, tests middleware overhead)
  const dashRes = http.get(`${BASE_URL}/dashboard/overview`);
  check(dashRes, {
    'dashboard responds': (r) => r.status > 0,
    'dashboard < 300ms': (r) => r.timings.duration < 300,
  });

  sleep(1);
}

export function handleSummary(data) {
  const passed = Object.values(data.metrics).every(m => !m.thresholds || Object.values(m.thresholds).every(t => t.ok));
  console.log(passed ? '\n✅ All thresholds passed!' : '\n❌ Some thresholds failed!');
  return {};
}
