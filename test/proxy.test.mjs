// The adapter, driven with real NextRequest/NextResponse objects.
//
// Next has no socket peer to offer - `NextRequest.ip` was removed in Next 15 -
// so every address here arrives on a header. That is not a shortcut in the
// test: it is the only thing the runtime exposes, which is why this adapter's
// default selector is a header rather than a connection.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { NextRequest, NextResponse } from 'next/server.js';
import { InternetData } from '@internetdata/internetdata';

import {
    LOOKUP_HEADER, createGuard, createProxy, defaultIpSelector, headerIpSelector, readLookup,
    xffIpSelector,
} from '../dist/index.js';

const data = JSON.parse(readFileSync(new URL('../testdata/testdata.json', import.meta.url), 'utf8'));
// Served answers from the lookup corpus: Unlimited's, and a paid plan's.
const UNLIMITED = data.lookup.find((c) => c.name === 'unlimited-answer').body;
const PAID = data.lookup.find((c) => c.name === 'paid-full-shape').body;
const PUBLIC_IP = PAID.ip;

function stubClient(body = PAID) {
    const asked = [];
    const client = new InternetData({
        cache: false,
        retries: 0,
        fetch: async (input) => {
            const url = new URL(typeof input === 'string' ? input : input.url);
            const ip = decodeURIComponent(url.pathname.slice(1));
            asked.push(ip);
            return new Response(JSON.stringify({ ...body, ip: ip }), {
                status: 200, headers: { 'content-type': 'application/json' },
            });
        },
    });
    return { client: client, asked: asked };
}

function request(headers = {}, url = 'https://example.test/') {
    return new NextRequest(new Request(url, { headers: headers }));
}

const fixedIp = () => PUBLIC_IP;

test('continues and forwards the answer to the app', async () => {
    const { client: client, asked: asked } = stubClient(UNLIMITED);
    const proxy = createProxy({ client: client, ipSelector: fixedIp });

    const response = await proxy(request());
    assert.equal(response.status, 200);

    const forwarded = readLookup(overriddenHeaders(response));
    assert.equal(forwarded.ip, PUBLIC_IP);
    assert.equal(forwarded.result.location.country, 'AT');
    assert.equal(forwarded.blocked, false);
    assert.deepEqual(asked, [PUBLIC_IP]);
});

// A header carries bytes, so an answer with a flag emoji or a currency sign must still go through,
// and read back as it was served: a paid answer carries both, and every member in full.
test('forwards an answer carrying text a header cannot hold as it is', async () => {
    const { client: client } = stubClient(PAID);
    const proxy = createProxy({ client: client, ipSelector: fixedIp });

    const response = await proxy(request());
    assert.equal(response.status, 200);

    const forwarded = readLookup(overriddenHeaders(response));
    assert.equal(forwarded.result.location.currency_symbol, PAID.location.currency_symbol);
    assert.equal(forwarded.result.location.flag_emoji, PAID.location.flag_emoji);
    assert.deepEqual(forwarded.result, PAID);
});

// NextResponse.next({ request: { headers } }) does not put the headers on the
// response; it records them for the server to replay onto the onward request.
// Reading them back is the only way to assert what the app will actually see.
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

test('blocks with 403 on a country condition, and passes another country', async () => {
    const blocking = createProxy({
        client: stubClient(UNLIMITED).client, ipSelector: fixedIp,
        blockCondition: { location: { country: ['DE', 'AT'] } },
    });
    const denied = await blocking(request());
    assert.equal(denied.status, 403);
    assert.deepEqual(await denied.json(), { error: 'access denied' });

    const allowing = createProxy({
        client: stubClient(UNLIMITED).client, ipSelector: fixedIp,
        blockCondition: { location: { country: 'DE' } },
    });
    assert.equal((await allowing(request())).status, 200);
});

test('blocks on a network type, and on anonymity, and passes a clean answer', async () => {
    const hosting = createProxy({
        client: stubClient(UNLIMITED).client, ipSelector: fixedIp,
        blockCondition: { asn: { type: 'hosting' } },
    });
    assert.equal((await hosting(request())).status, 403);

    const anonymous = createProxy({
        client: stubClient(PAID).client, ipSelector: fixedIp,
        blockCondition: [{ isTor: true }, { isVpn: true }],
    });
    assert.equal((await anonymous(request())).status, 403);

    const passing = createProxy({
        client: stubClient({ ...PAID, is_vpn: false, vpn: {} }).client, ipSelector: fixedIp,
        blockCondition: [{ isTor: true }, { isVpn: true }],
    });
    assert.equal((await passing(request())).status, 200);
});

test('onBlocked replaces the refusal entirely', async () => {
    const { client: client } = stubClient();
    const proxy = createProxy({
        client: client,
        ipSelector: fixedIp,
        blockCondition: { isVpn: true },
        onBlocked: (req, lookup) => NextResponse.redirect(
            new URL(`/no-vpn?p=${lookup.result.vpn.provider}`, req.url),
        ),
    });
    const response = await proxy(request());
    assert.equal(response.status, 307);
    assert.match(response.headers.get('location'), /\/no-vpn\?p=mullvad$/);
});

// The whole basis of trusting the header downstream. Without the delete, a
// visitor sets it themselves and tells the app whatever they like.
test('a forged lookup header from the caller is deleted before ours is set', async () => {
    const { client: client } = stubClient();
    const proxy = createProxy({ client: client, ipSelector: fixedIp });

    const forged = JSON.stringify({ ip: '8.8.8.8', blocked: false, result: { is_vpn: false } });
    const response = await proxy(request({ [LOOKUP_HEADER]: forged }));

    const forwarded = readLookup(overriddenHeaders(response));
    assert.equal(forwarded.ip, PUBLIC_IP, 'the forgery survived into the app');
    assert.equal(forwarded.result.is_vpn, true);
});

test('a forged header is deleted even when nothing was looked up', async () => {
    const { client: client } = stubClient();
    const proxy = createProxy({
        client: client, ipSelector: fixedIp, skip: () => true,
    });
    const forged = JSON.stringify({ ip: '8.8.8.8', blocked: false, result: { is_vpn: false } });
    const response = await proxy(request({ [LOOKUP_HEADER]: forged }));
    assert.equal(readLookup(overriddenHeaders(response)), undefined,
        'a skipped request must not carry a caller-supplied answer');
});

test('forward: false leaves the header off entirely', async () => {
    const { client: client } = stubClient();
    const proxy = createProxy({ client: client, ipSelector: fixedIp, forward: false });
    const response = await proxy(request());
    assert.equal(readLookup(overriddenHeaders(response)), undefined);
});

test('createGuard composes with a proxy that does other work', async () => {
    const { client: client } = stubClient();
    const guard = createGuard({ client: client, ipSelector: fixedIp });

    const req = request();
    const lookup = await guard(req);
    assert.equal(lookup.result.isVpn, true);
    assert.equal(lookup.blocked, false);

    const response = guard.forward(req, lookup);
    assert.equal(readLookup(overriddenHeaders(response)).result.is_vpn, true);
});

test('skip claims the request and costs no lookup', async () => {
    const { client: client, asked: asked } = stubClient();
    const proxy = createProxy({
        client: client, ipSelector: fixedIp, blockCondition: { isVpn: true },
        skip: (req) => req.nextUrl.pathname === '/',
    });
    assert.equal((await proxy(request())).status, 200);
    assert.deepEqual(asked, []);
});

test('a failing lookup lets the visitor through', async () => {
    const failing = new InternetData({
        retries: 0,
        fetch: async () => new Response('{"error":"boom"}', { status: 500 }),
    });
    const proxy = createProxy({
        client: failing, ipSelector: fixedIp, blockCondition: { isVpn: true },
    });
    const response = await proxy(request());
    assert.equal(response.status, 200);
    assert.equal(readLookup(overriddenHeaders(response)).error, 'server_error');
});

test('selectors read what they say they read', () => {
    const chained = request({ 'x-forwarded-for': `${PUBLIC_IP}, 70.41.3.18, 150.172.238.178` });
    assert.equal(defaultIpSelector(chained), PUBLIC_IP);
    assert.equal(xffIpSelector()(chained), PUBLIC_IP);
    assert.equal(xffIpSelector({ depth: 1 })(chained), '150.172.238.178');

    const cf = request({ 'cf-connecting-ip': '45.83.91.9' });
    assert.equal(headerIpSelector('CF-Connecting-IP')(cf), '45.83.91.9');
    assert.equal(defaultIpSelector(request({})), undefined,
        'Next has no socket peer, so with no forwarded header there is no address');
});

test('no resolvable address fails open rather than blocking everyone', async () => {
    const { client: client } = stubClient();
    const warnings = [];
    const proxy = createProxy({
        client: client, blockCondition: { isVpn: true }, onWarn: (m) => warnings.push(m),
    });
    const response = await proxy(request({}));
    assert.equal(response.status, 200);
    assert.match(warnings[0], /could not resolve a client address/);
});

test('the deadline bounds the request rather than the visitor waiting on us', async () => {
    const hung = new InternetData({ retries: 0, fetch: () => new Promise(() => {}) });
    const proxy = createProxy({
        client: hung, ipSelector: fixedIp, timeoutMs: 150, blockCondition: { isVpn: true },
    });
    const started = Date.now();
    const response = await proxy(request());
    assert.equal(response.status, 200);
    assert.equal(readLookup(overriddenHeaders(response)).error, 'network');
    assert.ok(Date.now() - started < 3000, 'the visitor was held past the budget');
});

test('a condition that constrains nothing is refused at construction', () => {
    assert.throws(() => createProxy({ blockCondition: { isVpn: false } }), /constrains nothing/);
    assert.throws(() => createGuard({ blockCondition: {} }), /constrains nothing/);
});

// Built exactly as the README builds it: an API key from the environment and nothing
// else. Every other test passes a client, so none could see the proxy fail to start,
// or send no key, the README's way.
test('builds as the README does, with the key set and unset', async () => {
    const realFetch = globalThis.fetch;
    const savedKey = process.env.INTERNETDATA_API_KEY;
    const sent = [];
    globalThis.fetch = async (input, init) => {
        const outgoing = new Request(input, init);
        if (new URL(outgoing.url).hostname !== 'api.internetdata.io') {
            return realFetch(input, init);
        }
        sent.push({ path: new URL(outgoing.url).pathname, auth: outgoing.headers.get('authorization') });
        return new Response(JSON.stringify(UNLIMITED), {
            status: 200, headers: { 'content-type': 'application/json' },
        });
    };
    try {
        for (const key of ['readme-key', undefined]) {
            if (key === undefined) {
                delete process.env.INTERNETDATA_API_KEY;
            } else {
                process.env.INTERNETDATA_API_KEY = key;
            }
            sent.length = 0;

            const proxy = createProxy({ apiKey: process.env.INTERNETDATA_API_KEY });

            const response = await proxy(request({ 'x-forwarded-for': PUBLIC_IP }));
            assert.equal(response.status, 200, `key ${key}`);
            assert.equal(readLookup(overriddenHeaders(response))?.result?.location.country, 'AT', `key ${key}`);
            assert.deepEqual(sent, [{ path: `/${PUBLIC_IP}`, auth: key === undefined ? null : `Bearer ${key}` }]);
        }
    } finally {
        globalThis.fetch = realFetch;
        if (savedKey === undefined) {
            delete process.env.INTERNETDATA_API_KEY;
        } else {
            process.env.INTERNETDATA_API_KEY = savedKey;
        }
    }
});
