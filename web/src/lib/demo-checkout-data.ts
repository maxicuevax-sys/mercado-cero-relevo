/** The public demo receipt contains no customer, account, transaction or merchant API identifiers. */
export type DemoCheckoutData = {
  demo: true;
  reference: string;
  totalCents: number;
  dueCents: number;
  status: string;
  items: { description: string; quantity: number; totalCents: number }[];
};
