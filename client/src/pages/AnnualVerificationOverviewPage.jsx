import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ClipboardCheck, ClipboardList, Trash2, History, ArrowRight } from 'lucide-react';

export const AnnualVerificationOverviewPage = () => {
  const navigate = useNavigate();
  const { canWrite } = useAuth();
  const toast = useToast();

  const verificationCards = [
    {
      id: 'new',
      title: 'New Verification',
      description: 'Start a new annual physical count and verify inventory items.',
      path: '/verification/new',
      icon: ClipboardList,
      requireWrite: true,
    },
    {
      id: 'issued-destroyed',
      title: 'Issued / Destroyed Items',
      description: 'Record items that have been issued out or destroyed during the period.',
      path: '/verification/issued-destroyed',
      icon: Trash2,
      requireWrite: false,
    },
    {
      id: 'history',
      title: 'Verification History',
      description: 'View past verification records.',
      path: '/verification/history',
      icon: History,
      requireWrite: false,
    }
  ];

  const handleCardClick = (card) => {
    if (card.requireWrite && !canWrite) {
      toast.info('Creating a new verification requires write permissions.');
      return;
    }
    navigate(card.path);
  };

  return (
    <AppShell breadcrumbs={[{ label: 'Annual Verification' }]}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-signal/15 text-signal flex items-center justify-center">
              <ClipboardCheck className="w-3.5 h-3.5" />
            </span>
            <h1 className="text-xl font-semibold text-ink tracking-tight">
              Annual Verification
            </h1>
          </div>
        </div>
      </div>

      {/* 3 Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {verificationCards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.id}
              id={`card-verification-${card.id}`}
              onClick={() => handleCardClick(card)}
              className="bg-card hover:bg-surface/50 rounded-xl border border-line p-5 shadow-card hover:border-signal/50 hover:shadow-subtle transition-all cursor-pointer flex flex-col justify-between group min-h-[180px]"
            >
              <div>
                {/* Icon in a small rounded square badge at the top */}
                <div className="w-9 h-9 rounded-lg bg-surface border border-line flex items-center justify-center text-slate group-hover:text-signal group-hover:border-signal/30 transition-colors mb-3.5">
                  <Icon className="w-4.5 h-4.5" />
                </div>

                {/* Bold title below it */}
                <h2 className="text-base font-semibold text-ink group-hover:text-signal transition-colors">
                  {card.title}
                </h2>

                {/* Short gray description text */}
                <p className="text-xs text-slate mt-2 leading-relaxed">
                  {card.description}
                </p>
              </div>

              {/* Open link with right-arrow at the bottom */}
              <div className="mt-5 pt-3 border-t border-line/60 flex items-center justify-between text-xs">
                <Link
                  to={card.path}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardClick(card);
                  }}
                  className="font-medium text-signal hover:underline flex items-center gap-1 group/btn py-0.5"
                >
                  <span>Open</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
};
