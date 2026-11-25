import React from 'react';
import { HubPage } from '../components/common/HubPage';
import { ArrowLeftRight, ArrowUpDown, ArrowUpRight, LayoutGrid } from 'lucide-react';

export const TransactionsOverviewPage = () => {
  const transactionCards = [
    {
      id: 'card-transaction-received',
      title: 'Received',
      description: 'Items received into inventory',
      to: '/transactions/received',
      icon: ArrowUpDown
    },
    {
      id: 'card-transaction-expended',
      title: 'Expended',
      description: 'Items issued or consumed',
      to: '/transactions/expended',
      icon: ArrowUpRight
    },
    {
      id: 'card-transaction-remaining',
      title: 'Remaining',
      description: 'Current balance (Received – Expended)',
      to: '/transactions/remaining',
      icon: LayoutGrid
    }
  ];

  return (
    <HubPage
      title="Transactions"
      subtitle="Overview of inventory transactions, stock inflows, outflows, and real-time balances."
      icon={ArrowLeftRight}
      breadcrumbs={[{ label: 'Transactions' }]}
      cards={transactionCards}
      backTo="/"
    />
  );
};

export default TransactionsOverviewPage;
