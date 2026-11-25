import React from 'react';
import { HubPage } from '../components/common/HubPage';
import { BarChart3, BarChart2, ArrowUpDown, ShieldCheck } from 'lucide-react';

export const ReportsOverviewPage = () => {
  const reports = [
    {
      id: 'card-report-inventory',
      title: 'Current Inventory Report',
      description: 'All inventory items with their serial numbers',
      to: '/reports/inventory',
      path: '/reports/inventory',
      icon: BarChart2
    },
    {
      id: 'card-report-transactions',
      title: 'Transaction History Report',
      description: 'Received and expended records by date and type',
      to: '/reports/transactions',
      path: '/reports/transactions',
      icon: ArrowUpDown
    },
    {
      id: 'card-report-verification',
      title: 'Verification Audit Report',
      description: 'Annual verification results and discrepancies',
      to: '/reports/verification',
      path: '/reports/verification',
      icon: ShieldCheck
    }
  ];

  return (
    <HubPage
      title="Reports"
      subtitle="Select a report to view, print or export."
      icon={BarChart3}
      breadcrumbs={[{ label: 'Reports' }]}
      cards={reports}
      backTo="/"
    />
  );
};

export default ReportsOverviewPage;
