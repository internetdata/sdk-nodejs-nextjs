# Changelog

What each release changed for you, newest first. Each line is a commit's summary, linked to its full description and diff.

## 1.0.1 - 2026-11-14

### Fixes

- Require @internetdata/internetdata 2.10.1: a 403 can mean the key lacks the ip.lookup scope ([`df4904b`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/df4904b4155affb5d2fd474bb0488df1987679a1))

## 1.0.0 - 2026-11-14

### Features

- Forward the visitor's InternetData record to your app with `createProxy`, read back with `readLookup`: the location, the network and the company behind the address, and the anonymity and hosting flags your plan serves ([`92969ab`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/92969ab518f3f26315908ffd3099920aad781b54))
- Refuse a request with a `blockCondition` written in the shape of a result, by country, network type, anonymity or any other member, with 403 or an `onBlocked` of your own, or decide in your own proxy with `createGuard` ([`92969ab`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/92969ab518f3f26315908ffd3099920aad781b54))
- Choose where the client address comes from: the left-most `X-Forwarded-For` entry by default, `xffIpSelector`, `headerIpSelector` for a header your edge writes, or a function of your own ([`92969ab`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/92969ab518f3f26315908ffd3099920aad781b54))
- Fail open on any lookup failure unless `failClosed` is set, with a 2500 ms bound, no retry and a cache per proxy by default, and build for the Edge runtime as well as Node.js ([`92969ab`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/92969ab518f3f26315908ffd3099920aad781b54))
