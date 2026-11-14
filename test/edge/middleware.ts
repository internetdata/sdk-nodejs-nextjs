// The README's Next 15 setup with no `runtime`, so Next builds it for Edge.
import { createProxy } from 'internetdata-next';

export const middleware = createProxy({ apiKey: process.env.INTERNETDATA_API_KEY });

export const config = { matcher: ['/whoami'] };
