// The published package, driving a real proxy, against the live API: keyless
// on prod and staging, and on staging with the CI key.
//
// The unit suite stubs the transport, so it proves the wiring and nothing about
// the artifact a stranger installs: a `files` list shipping no `dist`, an
// export map a consumer cannot resolve, or a release that never landed all pass
// it. It also cannot prove that the API key reaches the wire, because a stub
// answers the same either way.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NextRequest } from 'next/server.js';
import { createProxy, readLookup } from 'internetdata-next';

import { skipForNoKey, stagingKey } from '../lib/key.mjs';

const STAGING_API = 'https://api-staging.internetdata.io';

// A stable hosting address, sent as the client address through a selector
// rather than by spoofing a header, so the test is about the lookup rather than
// about trust-proxy configuration.
const PROBE = '146.70.116.130';

function serve(options) {
    const proxy = createProxy({ ipSelector: () => PROBE, ...options });
    return async () => {
        const response = await proxy(new NextRequest(new Request('https://example.test/')));
        const forwarded = readLookup(overriddenHeaders(response)) ?? {};
        return {
            status: response.status,
            body: {
                ip: forwarded.ip ?? null,
                error: forwarded.error ?? null,
                country: forwarded.result?.location?.country ?? null,
                members: Object.keys(forwarded.result ?? {}).sort(),
            },
        };
    };
}

// NextResponse.next({ request: { headers } }) records the onward headers rather
// than setting them on the response, so this is what the app would actually see.
function overriddenHeaders(response) {
    const overridden = {};
    for (const [name, value] of response.headers) {
        const match = name.match(/^x-middleware-request-(.+)$/);
        if (match) {
            overridden[match[1]] = value;
        }
    }
    return { get: (name) => overridden[name.toLowerCase()] ?? null };
}

for (const [env, baseUrl] of [['prod', undefined], ['staging', STAGING_API]]) {
    const where = baseUrl === undefined ? {} : { baseUrl: baseUrl };

    test(`${env}: a keyless lookup is forwarded to the app, and blocks on its country`, async () => {
        const res = await serve(where)();
        assert.equal(res.status, 200, 'enrichment alone must never refuse a request');
        assert.equal(res.body.error, null, `lookup failed: ${res.body.error}`);
        assert.equal(res.body.ip, PROBE);
        assert.match(res.body.country, /^[A-Z]{2}$/);
        assert.ok(res.body.members.includes('location'), 'location is on every plan');
        assert.ok(!res.body.members.includes('is_vpn'), 'is_vpn is paid, so absent without a key');

        const country = res.body.country;
        const blocking = serve({ ...where, blockCondition: { location: { country: country } } });
        assert.equal((await blocking()).status, 403, `a condition on ${country} must refuse it`);

        const other = country === 'AT' ? 'DE' : 'AT';
        const passing = serve({ ...where, blockCondition: { location: { country: other } } });
        assert.equal((await passing()).status, 200, `a condition on ${other} must not refuse ${country}`);
    });
}

// The CI key's organization is on the free plan, so its answer carries
// trial_expired, which no keyless answer does: the key reached the wire.
test('staging: the CI key reaches the wire', { skip: skipForNoKey() }, async () => {
    const res = await serve({ baseUrl: STAGING_API, apiKey: stagingKey() })();
    assert.equal(res.status, 200);
    assert.equal(res.body.error, null, `lookup failed: ${res.body.error}`);
    assert.ok(res.body.members.includes('trial_expired'), 'the answer is a keyless one');
});

test('an unreachable API fails open', async () => {
    // A reserved name that resolves to nothing, so this exercises a transport
    // failure rather than an error response.
    const call = serve({
        baseUrl: 'https://api.invalid.internetdata.example',
        blockCondition: { location: { country: 'AT' } },
        timeoutMs: 2000,
    });
    const res = await call();
    assert.equal(res.status, 200, 'an outage of ours must not take the customer down');
    assert.ok(res.body.error !== null, 'and the reason must be on the request');
});
