# `@hezos/aba-payway-sdk`

Reusable PayWay helpers extracted from Next.js route handlers.

## Install

```bash
npm install @hezos/aba-payway-sdk
# or
bun add @hezos/aba-payway-sdk
```

## API

```ts
import {
  initPayment,
  checkPaymentStatus,
  buildAbaMobileBankDeepLink,
  isMobileDevice,
} from "@hezos/aba-payway-sdk";
```

### `initPayment`

```ts
const payment = await initPayment({
  amount: "10",
  paywayLinkUrl: "https://link.payway.com.kh/YOUR_LINK_ID",
});
```

### `checkPaymentStatus`

```ts
const status = await checkPaymentStatus({
  clientId: "...",
  deviceId: "...",
  requestTime: "...",
  token: "...",
});
```

## Build package

```bash
cd packages/aba-payway-sdk
npm run build
```

## Validate PayWay link URL

```ts
import { validatePaywayLinkUrl } from "@hezos/aba-payway-sdk";

const result = await validatePaywayLinkUrl({
  paywayLinkUrl: "https://link.payway.com.kh/YOUR_LINK_ID",
});
```
