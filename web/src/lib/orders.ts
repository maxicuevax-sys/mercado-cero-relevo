import {
  audit,
  findOrCreateCustomer,
  getCredit,
  getDb,
  getOrder,
  listPayments,
  newId,
  nowIso,
} from "./db";
import type {
  CreateOrderInput,
  Credit,
  Order,
  Payment,
  PaymentMethod,
} from "./types";

export interface OrderDetail {
  order: Order;
  payments: Payment[];
  credit: Credit | null;
}

export function createOrder(input: CreateOrderInput): Order {
  const database = getDb();
  if (!input.items.length) {
    throw new Error("La venta necesita al menos un producto.");
  }

  const items = input.items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPriceCents = Math.round(Number(item.unitPriceCents));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("Cantidad inválida.");
    }
    if (!Number.isFinite(unitPriceCents) || unitPriceCents <= 0) {
      throw new Error("Precio inválido.");
    }
    return {
      id: newId("itm"),
      description: item.description.trim() || "Producto",
      quantity,
      unitPriceCents,
      totalCents: Math.round(quantity * unitPriceCents),
    };
  });

  const totalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
  const cashCents = Math.min(Math.max(0, Math.round(input.cashCents ?? 0)), totalCents);
  const creditCents = Math.min(
    Math.max(0, Math.round(input.creditCents ?? 0)),
    Math.max(0, totalCents - cashCents),
  );

  const id = newId("ord");
  const createdAt = nowIso();

  database
    .prepare(
      `INSERT INTO orders
       (id, merchant_id, status, total_cents, paid_cents, payment_method, customer_name, credit_cents, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      "lupita",
      "confirmed",
      totalCents,
      cashCents,
      cashCents > 0 ? "cash" : null,
      input.customerName ?? null,
      creditCents,
      createdAt,
      createdAt,
    );

  const insertItem = database.prepare(
    `INSERT INTO order_items (id, order_id, description, quantity, unit_price_cents, total_cents)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const item of items) {
    insertItem.run(item.id, id, item.description, item.quantity, item.unitPriceCents, item.totalCents);
  }

  if (cashCents > 0) {
    database
      .prepare(
        `INSERT INTO payments (id, order_id, provider, method, amount_cents, status, transaction_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId("pay"), id, "cash", "cash", cashCents, "paid", null, createdAt);
  }

  let creditId: string | null = null;
  if (creditCents > 0) {
    const customer = findOrCreateCustomer(input.customerName || "Cliente");
    creditId = newId("cred");
    database
      .prepare(
        `INSERT INTO credits (id, customer_id, order_id, original_cents, balance_cents, status, due_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(creditId, customer.id, id, creditCents, creditCents, "open", null, createdAt);
    database
      .prepare("UPDATE orders SET credit_id = ?, customer_name = ? WHERE id = ?")
      .run(creditId, customer.name, id);
  }

  const digitalDue = totalCents - cashCents - creditCents;
  if (digitalDue <= 0) {
    database
      .prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?")
      .run(creditCents > 0 ? "fulfilled" : "paid", nowIso(), id);
  }

  audit("order.created", "order", id, { totalCents, cashCents, creditCents, creditId });
  return getOrder(id)!;
}

export function attachPaymentLink(
  orderId: string,
  link: { id: string; url: string },
): Order {
  const database = getDb();
  database
    .prepare(
      "UPDATE orders SET payment_link_id = ?, payment_url = ?, status = 'payment_pending', updated_at = ? WHERE id = ?",
    )
    .run(link.id, link.url, nowIso(), orderId);
  audit("payment_link.attached", "order", orderId, link);
  return getOrder(orderId)!;
}

export function attachQr(
  orderId: string,
  qr: { id: string; qrString: string; qrImage: string | null },
  numRef: string,
): Order {
  const database = getDb();
  database
    .prepare(
      "UPDATE orders SET qr_id = ?, qr_string = ?, qr_image = ?, num_ref = ?, status = 'payment_pending', updated_at = ? WHERE id = ?",
    )
    .run(qr.id, qr.qrString, qr.qrImage, numRef, nowIso(), orderId);
  audit("codi_qr.attached", "order", orderId, { id: qr.id, numRef });
  return getOrder(orderId)!;
}

export function recordPayment(
  orderId: string,
  input: {
    provider: string;
    method: PaymentMethod;
    amountCents: number;
    transactionId: string | null;
    paymentLinkId?: string | null;
    rawEvent?: string | null;
  },
): Order {
  const database = getDb();
  const order = getOrder(orderId);
  if (!order) throw new Error("Pedido no encontrado.");

  if (input.transactionId) {
    const existing = database
      .prepare("SELECT id FROM payments WHERE transaction_id = ?")
      .get(input.transactionId) as { id: string } | undefined;
    if (existing) return order;
  }

  const amountCents = Math.max(0, Math.round(input.amountCents));
  if (amountCents <= 0) return order;

  try {
    database
      .prepare(
        `INSERT INTO payments
         (id, order_id, provider, method, amount_cents, status, transaction_id, payment_link_id, raw_event, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId("pay"),
        orderId,
        input.provider,
        input.method,
        amountCents,
        "paid",
        input.transactionId,
        input.paymentLinkId ?? null,
        input.rawEvent ?? null,
        nowIso(),
      );
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      return order;
    }
    throw error;
  }

  const sum = database
    .prepare("SELECT COALESCE(SUM(amount_cents), 0) AS total FROM payments WHERE order_id = ? AND status = 'paid'")
    .get(orderId) as { total: number };
  const paidCents = Number(sum.total);
  const methods = database
    .prepare("SELECT DISTINCT method FROM payments WHERE order_id = ? AND status = 'paid'")
    .all(orderId) as Array<{ method: string }>;
  const method = methods.length > 1 ? "mixed" : (methods[0]?.method as PaymentMethod) ?? input.method;

  const coveredCents = paidCents + order.creditCents;
  const status =
    coveredCents >= order.totalCents
      ? order.creditCents > 0
        ? "fulfilled"
        : "paid"
      : "partially_paid";
  database
    .prepare(
      "UPDATE orders SET paid_cents = ?, status = ?, payment_method = ?, updated_at = ? WHERE id = ?",
    )
    .run(paidCents, status, method, nowIso(), orderId);

  audit("payment.recorded", "order", orderId, {
    amountCents,
    method: input.method,
    transactionId: input.transactionId,
    status,
  });

  return getOrder(orderId)!;
}

export function recordCreditPayment(
  creditId: string,
  amountCents: number,
  method: PaymentMethod = "cash",
): Credit {
  const database = getDb();
  const credit = getCredit(creditId);
  if (!credit) throw new Error("Fiado no encontrado.");

  const amount = Math.min(Math.max(0, Math.round(amountCents)), credit.balanceCents);
  if (amount <= 0) return credit;

  database
    .prepare(
      "INSERT INTO credit_payments (id, credit_id, amount_cents, method, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(newId("cp"), creditId, amount, method, nowIso());

  const newBalance = credit.balanceCents - amount;
  database
    .prepare("UPDATE credits SET balance_cents = ?, status = ? WHERE id = ?")
    .run(newBalance, newBalance === 0 ? "settled" : "partial", creditId);

  audit("credit.payment", "credit", creditId, { amount, method, newBalance });
  return getCredit(creditId)!;
}

export function getOrderDetail(orderId: string): OrderDetail | null {
  const order = getOrder(orderId);
  if (!order) return null;
  return {
    order,
    payments: listPayments(orderId),
    credit: order.creditId ? getCredit(order.creditId) : null,
  };
}
