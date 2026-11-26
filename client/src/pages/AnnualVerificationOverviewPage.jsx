import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { HubPage } from '../components/common/HubPage';
import { ClipboardCheck, ClipboardList, Trash2, History, Users } from 'lucide-react';

export const AnnualVerificationOverviewPage = () => {
  const { canWrite } = useAuth();
  const toast = useToast();

  const handleNewVerificationClick = (e) => {
    if (!canWrite) {
      e?.preventDefault();
      toast.info('Creating a new verification requires write permissions.');
    }
  };

  const verificationCards = [
    {
      id: 'card-verification-teams',
      title: 'Verification Teams',
      description: 'Appoint and manage 3-member verification teams for all operational units.',
      to: '/verification/teams',
      icon: Users
    },
    {
      id: 'card-verification-new',
      title: 'New Verification',
      description: 'Start a new annual physical count and verify inventory items.',
      to: '/verification/new',
      icon: ClipboardList,
      requireWrite: true,
      onClick: handleNewVerificationClick
    },
    {
      id: 'card-verification-issued-destroyed',
      title: 'Issued / Destroyed Items',
      description: 'Record items that have been issued out or destroyed during the period.',
      to: '/verification/issued-destroyed',
      icon: Trash2
    },
    {
      id: 'card-verification-history',
      title: 'Verification History',
      description: 'View past verification records.',
      to: '/verification/history',
      icon: History
    },
    {
      id: 'card-verification-disposal-requests',
      title: 'Disposal Requests',
      description: 'Manage Board of Survey asset write-offs, committee decisions, and disposal execution.',
      to: '/disposal-requests',
      icon: ClipboardCheck
    }
  ];

  return (
    <HubPage
      title="Annual Verification"
      subtitle="Start a new count, record issued / destroyed items and review past verifications."
      icon={ClipboardCheck}
      breadcrumbs={[{ label: 'Annual Verification' }]}
      cards={verificationCards}
      backTo="/"
    />
  );
};

export default AnnualVerificationOverviewPage;
