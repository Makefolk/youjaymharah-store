import { createElement } from "react";
import { render } from "react-email";

import ClaimCreated from "../emails/claim-created";
import ExchangeCreated from "../emails/exchange-created";
import OrderCanceled from "../emails/order-canceled";
import OrderDelivered from "../emails/order-delivered";
import OrderPlaced from "../emails/order-placed";
import OrderShipped from "../emails/order-shipped";
import OrderUpdated from "../emails/order-updated";
import RefundIssued from "../emails/refund-issued";
import ReturnReceived from "../emails/return-received";
import ReturnRequested from "../emails/return-requested";

const previews = {
  "order-placed": OrderPlaced,
  "order-updated": OrderUpdated,
  "order-shipped": OrderShipped,
  "order-delivered": OrderDelivered,
  "order-canceled": OrderCanceled,
  "refund-issued": RefundIssued,
  "return-requested": ReturnRequested,
  "return-received": ReturnReceived,
  "exchange-created": ExchangeCreated,
  "claim-created": ClaimCreated,
};

describe("order emails", () => {
  it.each(Object.entries(previews))(
    "%s links to the order's page on the storefront, with an access key",
    async (_name, Preview) => {
      const html = await render(createElement(Preview));
      expect(html).toMatch(
        /href="https?:\/\/[^"]+\/orders\/order_[A-Za-z0-9]+\?key=\d+\.[\w-]+"/,
      );
    },
  );
});
