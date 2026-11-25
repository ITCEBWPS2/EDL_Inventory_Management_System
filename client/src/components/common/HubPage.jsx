import React from 'react';
import { AppShell } from '../layout/AppShell';
import { BackButton } from './BackButton';
import { HubCard } from './HubCard';

export const HubPage = ({
  title,
  subtitle,
  icon: Icon,
  breadcrumbs = [],
  cards = [],
  backTo = '/',
  headerActions = null,
  children = null,
  className = ''
}) => {
  return (
    <AppShell breadcrumbs={breadcrumbs}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            {Icon && (
              <span className="w-8 h-8 rounded-lg bg-[rgba(123,28,62,0.08)] text-[#7B1C3E] border border-[rgba(123,28,62,0.15)] flex items-center justify-center shrink-0 shadow-2xs">
                <Icon className="w-4 h-4" />
              </span>
            )}
            <h1 className="text-xl font-bold text-[#1B1B24] tracking-tight">
              {title}
            </h1>
          </div>
          {subtitle && (
            <p className="text-xs text-[#4A4D5A] mt-0.5 font-medium">
              {subtitle}
            </p>
          )}
        </div>
        {headerActions && (
          <div className="flex items-center gap-2">
            {headerActions}
          </div>
        )}
      </div>

      {/* 3 Columns Desktop (>=1100px), 2 Tablet, 1 Mobile */}
      <div className={`grid grid-cols-1 md:grid-cols-2 min-[1100px]:grid-cols-3 gap-5 items-stretch ${className}`}>
        {cards
          .filter(card => !card.hidden)
          .map((card) => (
            <HubCard
              key={card.id || card.title}
              {...card}
            />
          ))}
      </div>

      {/* Page extensions such as modals */}
      {children}

      {/* Standard bottom back button returning to Dashboard */}
      <BackButton to={backTo} id="btn-back-dashboard" />
    </AppShell>
  );
};

export default HubPage;

