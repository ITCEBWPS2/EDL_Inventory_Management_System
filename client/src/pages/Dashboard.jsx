import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/layout/AppShell';
import { StatCard } from '../components/common/StatCard';
import { DonutChart } from '../components/dashboard/DonutChart';
import { UnitTreeSearch } from '../components/dashboard/UnitTreeSearch';
import { LastVerificationCard } from '../components/dashboard/LastVerificationCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatDate } from '../utils/formatters';
import { ArrowRight, RotateCw } from 'lucide-react';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { user, selectedUnitId, changeActiveUnit, isSuperAdmin, canWrite } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await api.get('/dashboard', { unit_id: selectedUnitId });
      if (res.success) {
        setData(res.data);
      } else {
        setFetchError(true);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setFetchError(true);
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
    total_remaining: 0
  };

  // Limit recent transactions to 5 compact rows
  const recentTransactions = (data?.recent_transactions || []).slice(0, 5);

  const handleRowClick = (tx) => {
    if (tx.type === 'Expended') {
      navigate('/transactions/expended');
    } else {
      navigate('/transactions/received');
    }
  };

  return (
    <AppShell>
      {/* Page Header: Direct on page, compact row of ~48px height with soft text-shadow */}
      <div className="flex items-center justify-between min-h-[48px] h-12 mb-4">
        <div>
          <h1
            className="text-[22px] sm:text-[24px] font-bold text-white tracking-tight leading-none"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
          >
            Operational Dashboard
          </h1>
          <div
            aria-hidden="true"
            style={{
              width: '36px',
              height: '3px',
              borderRadius: '2px',
              backgroundColor: '#f6c026',
              marginTop: '6px'
            }}
          />
        </div>

        {/* Refresh button in white/translucent style */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={loading}
            title="Refresh dashboard data"
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 active:bg-white/35 text-white transition-all disabled:opacity-50 cursor-pointer shadow-xs"
            aria-label="Refresh dashboard data"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Row 1: The 4 KPI Cards in one slim row with equal heights & interactive links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4 mb-4">
        <StatCard
          label="Total Catalog Items"
          value={kpi.total_items}
          to="/inventory"
          loading={loading}
        />
        <StatCard
          label="Total Received Stock"
          value={kpi.total_received}
          to="/transactions/received"
          loading={loading}
        />
        <StatCard
          label="Total Expended Stock"
          value={kpi.total_expended}
          to="/transactions/expended"
          loading={loading}
        />
        <StatCard
          label="Current Remaining Stock"
          value={kpi.total_remaining}
          to="/transactions/remaining"
          highlight={true}
          loading={loading}
        />
      </div>

      {/* Row 2: Main Grid (Balanced two-column layout on Desktop >= 1280px, responsive stack on smaller screens) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 sm:gap-4 items-start">
        {/* Last Verification: Order 1 on mobile/tablet (< xl), Top-Right (cols 9-12) on desktop */}
        <div className="order-1 xl:order-2 xl:col-start-9 xl:col-span-4 xl:row-start-1">
          <LastVerificationCard
            lastVerification={data?.last_verification}
            selectedUnitId={selectedUnitId}
            canWrite={canWrite}
            loading={loading}
            error={fetchError}
            onRetry={fetchDashboardData}
          />
        </div>

        {/* Stock Distribution by Category: Order 2 on mobile/tablet (< xl), Top-Left (cols 1-8) on desktop */}
        <div className="order-2 xl:order-1 xl:col-start-1 xl:col-span-8 xl:row-start-1">
          <DonutChart
            data={data?.category_breakdown || []}
            title="Stock Distribution by Category"
            loading={loading}
            error={fetchError}
            onRetry={fetchDashboardData}
          />
        </div>

        {/* Recent Unit Transactions: Order 3 on mobile/tablet (< xl), Bottom-Left (cols 1-8) on desktop */}
        <div className="order-3 xl:order-3 xl:col-start-1 xl:col-span-8 xl:row-start-2">
          <div className="glass-card p-4 sm:p-[18px]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-[15px] font-semibold text-[#280818]">Recent Unit Transactions</h2>
                <p className="text-xs text-[#4A4D5A] mt-0.5 font-medium">Latest goods movements and issues</p>
              </div>
              <Link
                to="/transactions/remaining"
                className="text-xs font-semibold text-[#7a1a3c] hover:text-[#5a1230] flex items-center gap-1 transition-colors group shrink-0"
              >
                <span>View All Transactions</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[rgba(123,28,62,0.06)] border-b border-[rgba(27,27,36,0.09)] text-[11px] text-[#4A4D5A] uppercase font-semibold">
                    <th className="py-2 px-2.5">Type</th>
                    <th className="py-2 px-2.5">Date</th>
                    <th className="py-2 px-2.5">Item Details</th>
                    <th className="py-2 px-2.5">Voucher No</th>
                    <th className="py-2 px-2.5 text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(27,27,36,0.09)]">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="py-2 px-2.5"><div className="h-4 bg-white/60 rounded w-10"></div></td>
                        <td className="py-2 px-2.5"><div className="h-4 bg-white/60 rounded w-16"></div></td>
                        <td className="py-2 px-2.5"><div className="h-4 bg-white/60 rounded w-32"></div></td>
                        <td className="py-2 px-2.5"><div className="h-4 bg-white/60 rounded w-20"></div></td>
                        <td className="py-2 px-2.5 text-right"><div className="h-4 bg-white/60 rounded w-8 ml-auto"></div></td>
                      </tr>
                    ))
                  ) : recentTransactions.length > 0 ? (
                    recentTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        onClick={() => handleRowClick(tx)}
                        className="hover:bg-[rgba(123,28,62,0.04)] transition-colors cursor-pointer group"
                        title={`Click to view in ${tx.type} Items`}
                      >
                        <td className="py-2 px-2.5">
                          <StatusBadge status={tx.type_badge || tx.type} type={tx.type_badge || tx.type} />
                        </td>
                        <td className="py-2 px-2.5 text-[#4A4D5A] font-medium whitespace-nowrap tabular-nums">
                          {formatDate(tx.date)}
                        </td>
                        <td className="py-2 px-2.5 font-semibold text-[#280818] max-w-[220px]">
                          <div className="truncate group-hover:text-[#7a1a3c] transition-colors">{tx.item_name}</div>
                          {tx.item_code && (
                            <div className="text-[10px] text-[#4A4D5A] font-mono truncate" title={tx.item_code}>
                              {tx.item_code}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2.5 font-mono text-[#4A4D5A] whitespace-nowrap">
                          {tx.voucher_no || '—'}
                        </td>
                        <td className="py-2 px-2.5 text-right font-bold tabular-nums text-[#280818] whitespace-nowrap">
                          {tx.type === 'Expended' ? `-${tx.quantity}` : `+${tx.quantity}`}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-[#4A4D5A] text-xs font-medium">
                        No recent transactions recorded for this unit.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Organization Units: Order 4 on mobile/tablet (< xl), Bottom-Right (cols 9-12) on desktop */}
        <div className="order-4 xl:order-4 xl:col-start-9 xl:col-span-4 xl:row-start-2">
          <UnitTreeSearch
            unitTree={data?.unit_tree || []}
            selectedUnitId={selectedUnitId}
            onSelectUnit={(unit) => changeActiveUnit(unit.id)}
            isSuperAdmin={isSuperAdmin}
            userUnits={user?.units || []}
            loading={loading}
          />
        </div>
      </div>
    </AppShell>
  );
};

export default Dashboard;
