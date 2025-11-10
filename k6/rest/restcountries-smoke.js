import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend } from 'k6/metrics';

/**
 * Basic load profile: smoke + light
 * - 10 VU, 30s
 * SLA (yalnızca beklenen başarılı yanıtlar üzerinde):
 *   - p95 < 500ms
 *   - error rate < 1%
 */
export let options = {
    vus: 10,
    duration: '30s',
    thresholds: {
        // Sadece 2xx/3xx (expected_response:true) istekler üzerinde hesapla:
        'http_req_duration{expected_response:true}': ['p(95)<500'],
        'http_req_failed{expected_response:true}': ['rate<0.01'],
    },
};

const BASE = 'https://restcountries.com/v3.1';
const t_resp = new Trend('restcountries_response_time');

export default function () {
    // --- Happy path A: /name/turkey (tek ülke dizisi) ---
    group('Happy path: GET /name/turkey', () => {
        const res = http.get(`${BASE}/name/turkey`, { headers: { Accept: 'application/json' } });
        t_resp.add(res.timings.duration);

        // Loglama
        console.log(`Request: ${res.request.method} ${res.url}`);
        console.log(`Status: ${res.status}, Duration: ${res.timings.duration} ms`);
        console.log(`Body snippet: ${res.body.substring(0, 80)}...`);

        check(res, {
            'status is 200': (r) => r.status === 200,
            'json is array': (r) => { try { return Array.isArray(r.json()); } catch { return false; } },
            'schema: name.common:string': (r) => { try { return typeof r.json()?.[0]?.name?.common === 'string'; } catch { return false; } },
            'schema: cca2:string': (r) => { try { return typeof r.json()?.[0]?.cca2 === 'string'; } catch { return false; } },
            'functional: country is Turkey': (r) => { try { return r.json()?.[0]?.name?.common === 'Turkey'; } catch { return false; } },
            'resp time < 600ms (spot)': (r) => r.timings.duration < 600,
        });
    });

    // --- Happy path B: /alpha/tr (deterministik, küçük yanıt) ---
    group('Happy path: GET /alpha/tr', () => {
        const res = http.get(`${BASE}/alpha/tr`, { headers: { Accept: 'application/json' } });
        t_resp.add(res.timings.duration);

        // 🔹 Loglama
        console.log(`Request: ${res.request.method} ${res.url}`);
        console.log(`Status: ${res.status}, Duration: ${res.timings.duration} ms`);
        console.log(`Country Code: ${res.json()?.[0]?.cca2}`);

        check(res, {
            'status is 200': (r) => r.status === 200,
            'json is array (1)': (r) => { try { return Array.isArray(r.json()) && r.json().length >= 1; } catch { return false; } },
            'schema: cca2 == "TR"': (r) => { try { return r.json()?.[0]?.cca2 === 'TR'; } catch { return false; } },
            'schema: name.common:string': (r) => { try { return typeof r.json()?.[0]?.name?.common === 'string'; } catch { return false; } },
            'resp time < 600ms (spot)': (r) => r.timings.duration < 600,
        });
    });

    // --- Edge case: yanlış endpoint 404 (bilerek başarısız) ---
    // Bu çağrı threshold’ları ETKİLEMEZ çünkü expected_response:false tag’ıyla sayılır.
    group('Edge case: invalid endpoint → 404', () => {
        const res = http.get(`${BASE}/invalidendpoint`);

        // Loglama
        console.log(`Invalid endpoint test: ${res.url}`);
        console.log(`Status: ${res.status}`);

        check(res, { 'returns 404': (r) => r.status === 404 });
    });

    sleep(1);
}
