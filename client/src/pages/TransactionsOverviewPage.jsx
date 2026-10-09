import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { ArrowLeftRight, ArrowUpDown, ArrowUpRight, LayoutGrid, ArrowRight } from 'lucide-react';

export const TransactionsOverviewPage = () => {
  const navigate = useNavigate();

  const transactionCards = [
    {
      id: 'received',
      title: 'Received',
      subtitle: 'Items received into inventory',
      path: '/transactions/received',
      icon: ArrowUpDown,
    },
    {
      id: 'expended',
      title: 'Expended',
      subtitle: 'Items issued or consumed',
      path: '/transactions/expended',
      icon: ArrowUpRight,
    },
    {
      id: 'remaining',
      title: 'Remaining',
      subtitle: 'Current balance (Received – Expended)',
      path: '/transactions/remaining',
      icon: LayoutGrid,
    }
  ];

  return (
    <AppShell breadcrumbs={[{ label: 'Transactions' }]}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-md bg-signal/15 text-signal flex items-center justify-center">
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </span>
            <h1 className="text-xl font-semibold text-ink tracking-tight">
              Transactions
            </h1>
          </div>
          <p className="text-xs text-slate mt-0.5">
            Overview of inventory transactions, stock inflows, outflows, and real-time balances.
          </p>
        </div>
      </div>

      {/* 3 Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {transactionCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              id={`card-transaction-${card.id}`}
              onClick={() => navigate(card.path)}
              className="bg-card hover:bg-surface/50 rounded-xl border border-line p-5 shadow-card hover:border-signal/50 hover:shadow-subtle transition-all cursor-pointer flex flex-col justify-between group min-h-[160px]"
            >
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-surface border border-line flex items-center justify-center text-slate group-hover:text-signal group-hover:border-signal/30 transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h2 className="text-base font-semibold text-ink group-hover:text-signal transition-colors">
                    {card.title}
                  </h2>
                </div>
                <p className="text-xs text-slate mt-3 leading-relaxed">
                  {card.subtitle}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-line/60 flex items-center justify-between text-xs">
                <Link
                  to={card.path}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-signal hover:underline flex items-center gap-1 group/btn py-0.5"
                >
                  <span>View</span>
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
