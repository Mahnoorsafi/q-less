export type Branch = {
  id: string;
  name: string;
  address: string;
  recommended: string;
};

export type Service = {
  id: string;
  name: string;
  waitTime: number;
};

export const branches: Branch[] = [
  { id: '1', name: 'QMe Main Branch', address: 'Model Town, Lahore', recommended: 'Normal withdrawal service' },
  { id: '2', name: 'QMe City Branch', address: 'DHA, Lahore', recommended: 'Account opening & support' },
  { id: '3', name: 'QMe Express Branch', address: 'Gulberg, Lahore', recommended: 'Loan payment & quick service' }
];

export const services: Service[] = [
  { id: 's1', name: 'Cash Withdrawal', waitTime: 8 },
  { id: 's2', name: 'Account Opening', waitTime: 12 },
  { id: 's3', name: 'Customer Support', waitTime: 5 }
];
