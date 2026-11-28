# Changelog

What each release changed for you, newest first. Each line is a commit's summary, linked to its full description and diff.

## 1.1.2 - 2026-11-28

### Features

- Require @internetdata/internetdata 2.20.0: allowBots sends only a crawler's User-Agent, at most four an address ([`e078d84`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/e078d84670cf139de1b87c9112e2c31606f67f1e))

## 1.1.1 - 2026-11-26

### Features

- Require @internetdata/internetdata 2.19.0: a keyless answer without the bot, carrier, satellite and service flags ([`da66652`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/da66652900e0d0d1f35a5779feb7446b895acde2))

## 1.1.0 - 2026-11-25

### Features

- Let a verified crawler through with allowBots ([`8787633`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/8787633f7bc6f13c85aa4e313eb20f8060d21cf7))
- Require @internetdata/internetdata 2.18.0: a user agent sent with a lookup, and allowBots in the middleware core ([`9fddb58`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/9fddb587c4f4c2efba92e530b9b6524ee632a39b))

## 1.0.11 - 2026-11-24

### Features

- Require @internetdata/internetdata 2.17.0: a condition on a list member matches any element ([`8f52df1`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/8f52df153d17b05df3fa2099dc0f9634921ee92a))

## 1.0.10 - 2026-11-23

### Fixes

- Require internetdata 2.16.1 ([`54bf8d0`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/54bf8d0fb22c5c1b2c7d529085802309920a6298))

## 1.0.9 - 2026-11-22

### Features

- Require internetdata 2.16.0: block on isBot, and read a paid answer's bot ([`9dd3624`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/9dd3624f1a71e7073713761b088f8c696dae0900))
- README: block crawlers, monitors and scanners with isBot, on every plan ([`78f4fc9`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/78f4fc901b714cf6d563107505b466da899ef475))

## 1.0.8 - 2026-11-20

### Fixes

- Require internetdata 2.15.0: a paid domain answer's hosting, home page and linking domains ([`cf6b842`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/cf6b84278a519968ccb8e823ef69b887e497abac))

## 1.0.7 - 2026-11-20

### Fixes

- Require internetdata 2.14.2: the spec re-pinned to 2026.11.20 ([`5d8e441`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/5d8e4418510c981f5ab91bad973f2cef178347a7))

## 1.0.6 - 2026-11-19

### Fixes

- Require internetdata 2.14.1: a reduced answer is cached a minute at most ([`2e8d3ef`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/2e8d3ef1664b6e7f3230041f8e6b81e75f08f419))

## 1.0.5 - 2026-11-18

### Fixes

- Require internetdata 2.14.0: every request names the SDK ([`6ab6829`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/6ab68295a36bb4ce0a7b9b71ce5b1004ce009e5a))

## 1.0.4 - 2026-11-17

### Features

- Require internetdata 2.13.0: cap_reached on a paid answer past its overage cap ([`0823a3a`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/0823a3ae71485c2b1d5f48670c2afe6285717e99))

## 1.0.3 - 2026-11-16

### Features

- Require internetdata 2.12.0: an AS's rank, neighbors and hosted domains ([`b8d5ffa`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/b8d5ffa5835cd3a4dd361c7fbcfbfd8a2d6d147e))

## 1.0.2 - 2026-11-15

### Features

- Require internetdata 2.11.0: hosted_domains lists its 10 most popular domains ([`5d2c171`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/5d2c17162494bcb49dd7333534e257fa41c67e3e))

## 1.0.1 - 2026-11-14

### Fixes

- Require @internetdata/internetdata 2.10.1: a 403 can mean the key lacks the ip.lookup scope ([`df4904b`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/df4904b4155affb5d2fd474bb0488df1987679a1))

## 1.0.0 - 2026-11-14

### Features

- Forward the visitor's InternetData record to your app with `createProxy`, read back with `readLookup`: the location, the network and the company behind the address, and the anonymity and hosting flags your plan serves ([`92969ab`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/92969ab518f3f26315908ffd3099920aad781b54))
- Refuse a request with a `blockCondition` written in the shape of a result, by country, network type, anonymity or any other member, with 403 or an `onBlocked` of your own, or decide in your own proxy with `createGuard` ([`92969ab`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/92969ab518f3f26315908ffd3099920aad781b54))
- Choose where the client address comes from: the left-most `X-Forwarded-For` entry by default, `xffIpSelector`, `headerIpSelector` for a header your edge writes, or a function of your own ([`92969ab`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/92969ab518f3f26315908ffd3099920aad781b54))
- Fail open on any lookup failure unless `failClosed` is set, with a 2500 ms bound, no retry and a cache per proxy by default, and build for the Edge runtime as well as Node.js ([`92969ab`](https://github.com/internetdata/sdk-nodejs-nextjs/commit/92969ab518f3f26315908ffd3099920aad781b54))
