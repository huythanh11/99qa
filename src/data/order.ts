export type OrderDetails = {
  name: string;
  country: string;
  city: string;
  card: string;
  month: string;
  year: string;
};

// Test data only. DemoBlaze has no real payment processor.
export const order: OrderDetails = {
  name: 'QA Demo Buyer',
  country: 'Test Country',
  city: 'Test City',
  card: '4111111111111111',
  month: '12',
  year: '2030',
};
