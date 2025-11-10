import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend } from 'k6/metrics';

/**
 * Basic load profile: smoke + light
 * - 10 VU, 30s
 * SLA: p95 < 500ms, error rate < 1% (yalnızca expected_response:true üzerinde)
 */
export let options = {
    vus: 10,
    duration: '30s',
    thresholds: {
        'http_req_duration{expected_response:true}': ['p(95)<500'],
        'http_req_failed{expected_response:true}': ['rate<0.01'],
    },
};

const RM_BASE = 'https://rickandmortyapi.com/graphql';
const CT_BASE = 'https://countries.trevorblades.com/';
const respTime = new Trend('graphql_response_time');

// Basit retry + exponential backoff + kısa timeout
function postWithRetry(url, payload, headers, maxRetries = 2, perReqTimeout = '5s') {
    let attempt = 0;
    let res;
    let wait = 0.3;
    const params = { headers, timeout: perReqTimeout };

    while (attempt <= maxRetries) {
        res = http.post(url, JSON.stringify(payload), params);

        // Log her denemede
        console.log(
            `Attempt ${attempt + 1}/${maxRetries + 1} → ${url} [status=${res.status || 'N/A'}] (${res.timings.duration} ms)`
        );

        if (res.status && res.status >= 200 && res.status < 300) return res;

        // Network (status=0) veya 5xx → tekrar dene
        if (res.status === 0 || res.status >= 500) {
            console.log(`Retrying in ${wait}s due to status=${res.status}`);
            sleep(wait);
            wait *= 2;
            attempt += 1;
            continue;
        }
        // 4xx ise muhtemelen kalıcı → döndür
        return res;
    }
    return res;
}

export default function () {
    // Rick & Morty Happy Path
    group('Happy path: Rick&Morty characters(page:1)', () => {
        const query = `
      query {
        characters(page: 1) {
          results { id name status }
        }
      }
    `;
        const res = postWithRetry(RM_BASE, { query }, { 'Content-Type': 'application/json' }, 2, '5s');
        respTime.add(res.timings.duration);

        // Log çıktı
        console.log(`Request: ${RM_BASE}`);
        console.log(`Status: ${res.status}, Duration: ${res.timings.duration} ms`);
        console.log(`Body snippet: ${res.body?.substring(0, 120)}...`);

        const ok = check(res, { 'status is 200': (r) => r.status === 200 });

        if (ok) {
            check(res, {
                'has data.characters.results array': (r) => {
                    try { return Array.isArray(r.json().data.characters.results); } catch { return false; }
                },
                'schema: result has id/name/status': (r) => {
                    try {
                        const it = r.json().data.characters.results[0];
                        const idOk = typeof it?.id === 'string' || typeof it?.id === 'number';
                        return idOk && typeof it?.name === 'string' && typeof it?.status === 'string';
                    } catch { return false; }
                },
                'functional: contains "Rick Sanchez"': (r) => {
                    try { return r.json().data.characters.results.map((c) => c?.name).includes('Rick Sanchez'); } catch { return false; }
                },
                'resp time < 600ms (spot)': (r) => r.timings.duration < 600,
            });
        } else {
            // Fallback: Countries GraphQL (Türkiye verisi)
            group('Fallback: Countries GraphQL country(code:"TR")', () => {
                const q = `
          query {
            country(code: "TR") {
              code
              name
              continent { name }
            }
          }
        `;
                const fres = postWithRetry(CT_BASE, { query: q }, { 'Content-Type': 'application/json' }, 2, '5s');
                respTime.add(fres.timings.duration);

                // Log çıktı
                console.log(`Fallback Request: ${CT_BASE}`);
                console.log(`Status: ${fres.status}, Duration: ${fres.timings.duration} ms`);
                console.log(`Response JSON: ${JSON.stringify(fres.json()?.data?.country)}`);

                const fok = check(fres, { 'status is 200 (fallback)': (r) => r.status === 200 });
                if (fok) {
                    check(fres, {
                        'fallback: has data.country': (r) => { try { return !!r.json().data.country; } catch { return false; } },
                        'fallback schema: code & name strings': (r) => {
                            try {
                                const c = r.json().data.country;
                                return typeof c?.code === 'string' && typeof c?.name === 'string';
                            } catch { return false; }
                        },
                        'fallback functional: code=="TR"': (r) => {
                            try { return r.json().data.country.code === 'TR'; } catch { return false; }
                        },
                        'fallback resp time < 600ms (spot)': (r) => r.timings.duration < 600,
                    });
                }
            });
        }
    });

    // Edge case: Rick & Morty invalid field → GraphQL error/400
    group('Edge case: invalid field → GraphQL error / 400', () => {
        const badQuery = `query { invalidField { name } }`;
        const res = http.post(RM_BASE, JSON.stringify({ query: badQuery }), {
            headers: { 'Content-Type': 'application/json' },
            timeout: '5s',
        });

        // Log çıktı
        console.log(`Invalid Query sent to: ${RM_BASE}`);
        console.log(`Status: ${res.status}, Duration: ${res.timings.duration} ms`);
        console.log(`Error Body: ${res.body?.substring(0, 120)}...`);

        check(res, {
            'GraphQL returns errors or HTTP 400': (r) => {
                try { return r.status === 400 || !!r.json()?.errors; } catch { return r.status === 400; }
            },
        });
    });

    sleep(1);
}
