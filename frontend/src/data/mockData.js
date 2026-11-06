import { daysAgoISO } from '../utils/format';

export const accounts = [
  {
    id: 'CHK-001',
    name: 'Everyday Checking',
    type: 'Checking',
    balance: 12840.55,
    available: 12110.55,
    currency: 'USD',
    lastFour: '4821',
  },
  {
    id: 'SAV-002',
    name: 'Growth Savings',
    type: 'Savings',
    balance: 24500.0,
    available: 24500.0,
    currency: 'USD',
    lastFour: '9137',
  },
];

export const transactions = [
  {
    id: 'TX-10482',
    date: daysAgoISO(1),
    description: 'Salary Deposit',
    category: 'Income',
    amount: 3250,
    type: 'credit',
    status: 'Completed',
  },
  {
    id: 'TX-10481',
    date: daysAgoISO(2),
    description: 'FreshMart Groceries',
    category: 'Groceries',
    amount: -86.42,
    type: 'debit',
    status: 'Completed',
  },
  {
    id: 'TX-10480',
    date: daysAgoISO(3),
    description: 'Metro Energy',
    category: 'Utilities',
    amount: -124.8,
    type: 'debit',
    status: 'Completed',
  },
  {
    id: 'TX-10479',
    date: daysAgoISO(4),
    description: 'CloudStream Internet',
    category: 'Bills',
    amount: -59.99,
    type: 'debit',
    status: 'Completed',
  },
  {
    id: 'TX-10478',
    date: daysAgoISO(5),
    description: 'Northside Cafe',
    category: 'Dining',
    amount: -18.5,
    type: 'debit',
    status: 'Completed',
  },
  {
    id: 'TX-10477',
    date: daysAgoISO(6),
    description: 'Transfer from Savings',
    category: 'Transfer',
    amount: 500,
    type: 'credit',
    status: 'Completed',
  },
  {
    id: 'TX-10476',
    date: daysAgoISO(7),
    description: 'RideNow',
    category: 'Transport',
    amount: -24.25,
    type: 'debit',
    status: 'Completed',
  },
  {
    id: 'TX-10475',
    date: daysAgoISO(8),
    description: 'HealthPlus Insurance',
    category: 'Insurance',
    amount: -112.0,
    type: 'debit',
    status: 'Pending',
  },
  {
    id: 'TX-10474',
    date: daysAgoISO(9),
    description: 'Green Market',
    category: 'Groceries',
    amount: -64.17,
    type: 'debit',
    status: 'Completed',
  },
  {
    id: 'TX-10473',
    date: daysAgoISO(10),
    description: 'Bright Mobile',
    category: 'Bills',
    amount: -42.0,
    type: 'debit',
    status: 'Completed',
  },
];

export const beneficiaries = [
  { id: 'ben-1', name: 'Ava Johnson', bank: 'Northstar Bank', account: '•••• 7732' },
  { id: 'ben-2', name: 'Liam Chen', bank: 'Finora Bank', account: '•••• 2914' },
  { id: 'ben-3', name: 'Olivia Smith', bank: 'Union Credit', account: '•••• 6408' },
];

export const cards = [
  {
    id: 'card-1',
    name: 'Finora Platinum',
    number: '4821',
    expiry: '08/29',
    status: 'Active',
    limit: 8000,
    spent: 1840.25,
    frozen: false,
  },
  {
    id: 'card-2',
    name: 'Finora Everyday',
    number: '9137',
    expiry: '03/28',
    status: 'Active',
    limit: 4000,
    spent: 920.4,
    frozen: false,
  },
];

export const notifications = [
  {
    id: 'n1',
    title: 'Security check complete',
    message: 'Your recent sign-in was verified.',
    time: '10 min ago',
    read: false,
  },
  {
    id: 'n2',
    title: 'Bill payment due soon',
    message: 'Your Metro Energy demo payment is coming up soon.',
    time: '2 hrs ago',
    read: false,
  },
  {
    id: 'n3',
    title: 'Transfer completed',
    message: 'Your transfer to Ava Johnson was completed.',
    time: 'Yesterday',
    read: true,
  },
];

const dueInDays = (days) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

export const upcomingPayments = [
  { name: 'Metro Energy', due: dueInDays(3), amount: 124.8, category: 'Electricity' },
  { name: 'CloudStream Internet', due: dueInDays(7), amount: 59.99, category: 'Internet' },
  { name: 'HealthPlus Insurance', due: dueInDays(12), amount: 112, category: 'Insurance' },
];
