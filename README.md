# [<img src="https://s3.internetdata.io/internetdata-public/brand/mark.svg" alt="InternetData" height="28"/>](https://internetdata.io/) InternetData Next.js Middleware

[![npm](https://img.shields.io/npm/v/internetdata-next.svg)](https://www.npmjs.com/package/internetdata-next)
[![license](https://img.shields.io/npm/l/internetdata-next.svg)](LICENSE)

The official [Next.js](https://nextjs.org) proxy middleware for the [InternetData](https://internetdata.io) API.

It looks up the visitor behind each request, where they are, which network they come from and whether it's a VPN, a proxy, Tor or a hosting server, and forwards the answer to your app, where Server Components and Route Handlers can read it. Blocking is opt-in.

## Getting Started

```bash
npm install internetdata-next
```

Requires Node.js 22 or newer and Next.js 15 or newer. The proxy runs on the Node.js runtime and, on Next 15, on the Edge runtime too.

Without an API key a lookup is on Unlimited, the free plan: the country, the network and the company behind the address, Tor, relay and anycast, with no daily or monthly cap. Every lookup your app makes comes from your server's address, though, so a busy site will see bursts refused. A paid plan answers every field, VPN, the proxy flags, hosting, CDN, bots, carriers, satellites, the service flags and the city among them; create a key in the [console](https://app.internetdata.io). A free account tries every field.

Next 16 renamed the file convention from `middleware.ts` to `proxy.ts`, and the export from `middleware` to `proxy`. Both work on 16, where `middleware.ts` logs a deprecation, so use whichever your version supports.

```ts
// proxy.ts
import { createProxy } from 'internetdata-next';

export const proxy = createProxy({ apiKey: process.env.INTERNETDATA_API_KEY });

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
```

On Next 15 the file is `middleware.ts`, and it runs on the Edge runtime unless its `config` asks for `runtime: 'nodejs'`, which is stable from 15.5. Either works:

```ts
// middleware.ts, on Next 15
import { createProxy } from 'internetdata-next';

export const middleware = createProxy({ apiKey: process.env.INTERNETDATA_API_KEY });

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
```

Then read the answer anywhere downstream:

```tsx
// app/page.tsx
import { Suspense } from 'react';
import { headers } from 'next/headers';
import { readLookup } from 'internetdata-next';

async function Greeting() {
    const lookup = readLookup(await headers());
    return `Hello, visitor from ${lookup?.result?.location.country_name ?? 'somewhere'}`;
}

export default function Page() {
    return (
        <main>
            <Suspense fallback="Hello">
                <Greeting />
            </Suspense>
        </main>
    );
}
```

The read of `headers()` sits inside `<Suspense>` because a new Next 16 app turns Cache Components on, and `next build` then refuses a page that reads request data outside one.

By default nothing is blocked. Your own code decides what the answer means: a currency to show, a sign-up to review, a page to keep from some countries.

**Set a `matcher`.** Without one the proxy runs on every request including static assets, which costs a lookup each.

## Blocking

Pass a `blockCondition` and a matching request is answered with `403` and never reaches your app.

```ts
export const proxy = createProxy({
    apiKey: process.env.INTERNETDATA_API_KEY,
    blockCondition: { location: { country: ['CU', 'IR', 'KP'] } },
});
```

A condition is written in the shape of a result, and only the members you name are considered, so it can refuse on anything in the answer. The country works on every plan, and so do `isTor`, `isRelay` and `isAnycast`; the others here need a paid plan or the trial:

```ts
blockCondition: { asn: { type: 'hosting' } }                          // the network's type
blockCondition: [{ isAnycast: true }, { isSatellite: true }]          // anycast and satellite space
blockCondition: { isBot: true }                                       // crawlers, monitors and scanners
blockCondition: [{ isHosting: true }, { isCdn: true }]                // traffic from servers, not people
blockCondition: [{ isVpn: true }, { isTor: true }, { isResproxy: true }]  // anonymity: a list is OR
blockCondition: { isVpn: true, vpn: { provider: 'nordvpn' } }         // one provider
blockCondition: { resproxy: { hits: { gte: 5 } } }                    // a numeric threshold
```

Values are matched by equality, strings without regard to case. An array means any-of. `{ gte, gt, lte, lt }` compares numbers, and every bound you give must hold, so two of them are a range. A member the answer holds as a list matches when any one element does, every member of an object term on the same element: `{ web: { port: 443 } }`, `{ pubproxy: { protocols: 'socks5' } }`. Members you set to `false` or `null` are ignored, so a condition states the signals you act on; one that constrains nothing would match every request, and is refused when the proxy is created rather than silently blocking all your traffic.

Replace the refusal with `onBlocked`. A redirect is usually friendlier than a 403:

```ts
onBlocked: (request) => NextResponse.redirect(new URL('/unavailable', request.url)),
```

## Let a verified crawler through

`allowBots` sends a request's own `User-Agent` with its lookup when it names a crawler, and a request whose answer's `userAgent.verdict` is `verified`, a crawler its operator vouches for such as Googlebot from Google's addresses, is never blocked, whatever `blockCondition` matches. The answer is still forwarded, its `user_agent` included:

```ts
export const proxy = createProxy({
    apiKey: process.env.INTERNETDATA_API_KEY,
    blockCondition: { isBot: true },
    allowBots: true,
});
```

A client claiming to be a crawler from an address its operator does not vouch for reads `spoofed`, so `blockCondition: { userAgent: { verdict: 'spoofed' } }` refuses a forged crawler. Any other agent, or none, is not sent, since its verdict could only be `not_bot`. One address is looked up with at most four crawler agents an hour: past those its lookup sends none, and a request passes as a crawler only where the answer's `bot.verified` is true. It is off by default, and then no agent is sent and the cache keeps one answer per address rather than one per address and agent. A verdict needs a paid plan or the trial: a served answer without one is reported once under `onMissingField`.

## Doing other work in the same proxy

Most apps already have a proxy. Use `createGuard` and call it from yours:

```ts
import { NextResponse } from 'next/server';
import { createGuard } from 'internetdata-next';

const guard = createGuard({ apiKey: process.env.INTERNETDATA_API_KEY });

export async function proxy(request: NextRequest) {
    const lookup = await guard(request);
    if (lookup?.result?.isTor) {
        return NextResponse.redirect(new URL('/verify', request.url));
    }
    return guard.forward(request, lookup);
}
```

`guard.forward` continues to your app carrying the answer. Return it rather than a bare `NextResponse.next()`, or nothing downstream can read the lookup.

## Where the client address comes from

This is the setting that decides whether any of the above works, and Next makes it more your problem than most frameworks do.

**Next has no socket peer to offer.** `NextRequest.ip` was removed in Next 15, and a proxy runs ahead of the server, so a forwarded header is the only address available: this is the one place where the default is a header rather than a connection.

The default reads the left-most `X-Forwarded-For` entry. That is correct when the platform in front of you **overwrites** the header, which Vercel does and any ingress you control can be configured to. Behind something that **appends**, the left-most entry is whatever the visitor sent, so they choose the address that gets looked up.

For a platform that writes its own header, name it:

```ts
import { headerIpSelector } from 'internetdata-next';

createProxy({
    apiKey: process.env.INTERNETDATA_API_KEY,
    ipSelector: headerIpSelector('CF-Connecting-IP'),  // or True-Client-IP, or your own
});
```

If you know how many proxies sit in front, count from the right: `xffIpSelector({ depth: 1 })` is the address your nearest proxy saw. Anything else, pass your own function. It receives the `NextRequest` and returns an address.

If the address resolves to a private one, or to nothing at all, the proxy says so once on `console.warn`. That is expected running locally and is the signal to fix your configuration anywhere else.

## The forwarded header

The answer travels to your app on `x-internetdata`, because a proxy runs in its own context and a request header is the only thing that crosses into it.

**Any copy the caller sent is deleted before ours is written.** That overwrite is the entire basis of trusting it downstream: without it a visitor could set the header themselves and tell your app whatever they liked about their own address. It is the same rule an ingress follows for a real-IP header, and it holds even when the request was skipped.

Turn it off with `forward: false` if you only ever block and never read the answer.

## When a lookup fails

The request is let through, and the reason is on `lookup.error`. Our outage should not become yours, so a network failure, a rate limit or a rejected key all fail open. Pass `failClosed: true` to block instead.

## Cost and latency

Answers are cached for an hour per proxy instance, so a returning visitor costs nothing, and private addresses never leave the process. A cache miss is one request to our API, bounded at 2500 ms by default and not retried: on a request path, failing open quickly beats holding a visitor while we try again.

```ts
createProxy({ apiKey: KEY, timeoutMs: 1000, retries: 1, cache: { max: 50000, ttlMs: 600000 } })
```

A serverless deployment gets less from the cache than a long-running one, because the instance holding it is short-lived. Narrow the `matcher`, or `skip` what you do not care about:

```ts
skip: (request) => request.nextUrl.pathname.startsWith('/api/health'),
```

Beyond a few million distinct visitors a day, stop calling the API per request: look addresses up locally in [our databases](https://internetdata.io/databases) instead.

## Absent is not false

Unlimited, with a key or without one, leaves out `isVpn`, `isHosting`, `isCdn`, the four proxy flags, `isBot`, `isCarrier`, `isSatellite` and the five service flags, the detail behind them, `user_agent`, and the paid members inside `location`, `asn`, `company` and `abuse`, such as `location.city`. A field your plan does not include is absent, which means "not in your plan" rather than "checked, and no". The forwarded answer keeps its wire names:

```ts
lookup.result?.is_vpn ?? false   // when you only want the flag
```

A `blockCondition` naming a member your plan does not serve, `location.city` on Unlimited included, can never match, so the proxy warns once instead of failing silently. Set `onMissingField: 'throw'` to make it an error.

## Other Libraries

There are official InternetData client libraries available for many languages including PHP, Python, Go, Java, and Ruby. See our GitHub at https://github.com/internetdata for more.

## About InternetData

Geolocation, anonymity, ownership, network, service and domain data for any IP address, AS or domain, by API or as databases you download.

[<picture><source media="(prefers-color-scheme: dark)" srcset="https://s3.internetdata.io/internetdata-public/brand/logo-dark.svg"><img src="https://s3.internetdata.io/internetdata-public/brand/logo.svg" alt="InternetData" height="40"/></picture>](https://internetdata.io/)

## License

This project is licensed under the [MIT License](LICENSE).
