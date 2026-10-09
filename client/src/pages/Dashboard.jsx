import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/layout/AppShell';
import { KpiCard } from '../components/dashboard/KpiCard';
import { DonutChart } from '../components/dashboard/DonutChart';
import { UnitTreeSearch } from '../components/dashboard/UnitTreeSearch';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatDate } from '../utils/formatters';
import { ArrowRight, ClipboardCheck, AlertTriangle, Boxes, Plus } from 'lucide-react';

export const Dashboard = () => {
  const { user, selectedUnitId, selectedUnit, changeActiveUnit, canWrite, isSuperAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard', { unit_id: selectedUnitId });
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedUnitId]);

  const kpi = data?.kpi || {
    total_items: 0,
    total_received: 0,
    total_expended: 0,
    total_remaining: 0,
    low_stock_count: 0
  };

  return (
    <AppShell>
      {/* Page Title & Operational Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink tracking-tight">
            Operational Dashboard
          </h1>
          <p className="text-xs text-slate mt-0.5">
            Real-time inventory levels, transactions, and annual verification tracking for{' '}
            <span className="font-semibold text-ink">
              {selectedUnit ? selectedUnit.unit_name : 'All Monitored Units'}
            </span>
          </p>
        </div>

        {canWrite && (
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/transactions/received"
              className="px-3.5 py-2 bg-ink hover:bg-[#193254] text-white text-xs font-medium rounded transition-colors shadow-subtle flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-signal" />
              <span>Record Received</span>
            </Link>
          </div>
        )}
      </div>

      {/* Row of Compact KPI Cards (Hero numbers in --ink with tabular numerals) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Catalog Items"
          value={kpi.total_items}
          badgeText="Active SKUs"
          subtext="Master distribution inventory"
        />
        <KpiCard
          label="Total Received Stock"
          value={kpi.total_received}
          badgeText="Inflow"
          subtext="Certified store vouchers"
        />
        <KpiCard
          label="Total Expended Stock"
          value={kpi.total_expended}
          badgeText="Outflow"
          subtext="Substation & line issues"
        />
        <KpiCard
          label="Current Remaining Stock"
          value={kpi.total_remaining}
          highlight={true}
          badgeText="Available"
          subtext={kpi.low_stock_count > 0 ? `${kpi.low_stock_count} items with low stock` : 'Reconciled & balanced'}
        />
      </div>

      {/* Main Analytics Grid: Donut Chart & Unit Tree Hierarchy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Category Breakdown Donut Chart (Lead segment in --signal) */}
        <div className="lg:col-span-2">
          <DonutChart
            data={data?.category_breakdown || []}
            title="Stock Distribution by Category"
          />
        </div>

        {/* Hierarchical Unit / Location Tree Navigator */}
        <div className="lg:col-span-1">
          <UnitTreeSearch
            unitTree={data?.unit_tree || []}
            selectedUnitId={selectedUnitId}
            onSelectUnit={(unit) => changeActiveUnit(unit.id)}
            isSuperAdmin={isSuperAdmin}
            userUnits={user?.units || []}
          />
        </div>
      </div>

      {/* Bottom Section: Recent Transactions Table & Annual Verification Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions List with Semantic Type Badges */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-line shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">Recent Unit Transactions</h2>
              <p className="text-[11px] text-slate">Latest goods movements and issues</p>
            </div>
            <Link
              to="/transactions/remaining"
              className="text-xs font-semibold text-ink hover:text-signal flex items-center gap-1 transition-colors"
            >
              <span>View All Transactions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-line text-[11px] text-slate uppercase font-medium">
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Item Details</th>
                  <th className="py-2.5 px-3">Voucher No</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {data?.recent_transactions?.length > 0 ? (
                  data.recent_transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-surface/50 transition-colors">
                      <td className="py-2.5 px-3">
                        <StatusBadge status={tx.type_badge || tx.type} type={tx.type_badge || tx.type} />
                      </td>
                      <td className="py-2.5 px-3 text-slate whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-ink">
                        <div>{tx.item_name}</div>
                        <div className="text-[10px] text-slate font-mono">{tx.item_code}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate">
                        {tx.voucher_no}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-ink">
                        {tx.type === 'Expended' ? `-${tx.quantity}` : `+${tx.quantity}`}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate text-xs">
                      No recent transactions recorded for this unit.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Verification Status Card */}
        <div className="lg:col-span-1 bg-card rounded-xl border border-line shadow-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ClipboardCheck className="w-4 h-4 text-signal" />
              <h3 className="text-sm font-semibold text-ink">Annual Verification</h3>
            </div>

            {data?.verification_status?.has_verification ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-lg bg-surface border border-line">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate">Status</span>
                    <StatusBadge status={data.verification_status.status} />
                  </div>
                  <div className="text-xs text-slate mt-2">Cycle Year:</div>
                  <div className="text-base font-semibold text-ink tabular-nums">
                    {data.verification_status.year} Audit Cycle
                  </div>
                </div>

                <div className="text-xs text-slate space-y-1">
                  <div className="font-medium text-ink">Board of Survey:</div>
                  {data.verification_status.verified_by?.map((v, i) => (
                    <div key={i} className="text-[11px] truncate flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-signal"></span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-slate text-xs">
                No active annual verification in progress for current year.
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-line mt-4">
            <Link
              to="/verification/history"
              className="w-full py-2 px-3 rounded bg-surface hover:bg-line text-ink text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-line"
            >
              <span>Verification Audit Trail</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
};
