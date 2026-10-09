import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { DataTable } from '../components/common/DataTable';
import { KpiCard } from '../components/dashboard/KpiCard';
import { BackButton } from '../components/common/BackButton';
import { formatNumber, exportToCSV } from '../utils/formatters';
import { Download, Calculator, Lock } from 'lucide-react';

export const RemainingInventory = () => {
  const { selectedUnitId, selectedUnit } = useAuth();
  const toast = useToast();

  const [remainingList, setRemainingList] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRemaining = async () => {
    setLoading(true);
    try {
      const [receivedRes, expendedRes, invRes] = await Promise.all([
        api.get('/transactions/received', { unit_id: selectedUnitId }),
        api.get('/transactions/expended', { unit_id: selectedUnitId }),
        api.get('/inventory', { all: 'true' })
      ]);

      const receivedData = receivedRes.success ? (receivedRes.data || []) : [];
      const expendedData = expendedRes.success ? (expendedRes.data || []) : [];

      // Build a catalog lookup map to resolve any legacy UUIDs in item_name
      const catalogMap = new Map();
      if (invRes.success && Array.isArray(invRes.data)) {
        invRes.data.forEach(item => {
          if (item.id && item.item_name) {
            catalogMap.set(item.id.toLowerCase(), item.item_name.trim());
          }
        });
      }

      // Safe name resolver for received and expended entries
      const resolveItemName = (tx) => {
        let name = (tx.item_name || '').trim();
        if (catalogMap.has(name.toLowerCase())) {
          return catalogMap.get(name.toLowerCase());
        }
        if ((!name || name === 'Unknown Item') && tx.item_id) {
          const idKey = String(tx.item_id).toLowerCase();
          if (catalogMap.has(idKey)) {
            return catalogMap.get(idKey);
          }
          if (!tx.item_id.match(/^[0-9a-f-]{36}$/i)) {
            return tx.item_id.trim();
          }
        }
        if (tx.item_id && (!name || name === 'Unknown Item')) {
          const idKey = String(tx.item_id).toLowerCase();
          if (catalogMap.has(idKey)) {
            return catalogMap.get(idKey);
          }
        }
        return name;
      };

      // Group strictly by received items (never include unreceived catalog items)
      const itemMap = new Map();

      receivedData.forEach(r => {
        const name = resolveItemName(r);
        if (!name || name === 'Unknown Item') return;

        const norm = name.toLowerCase();
        if (!itemMap.has(norm)) {
          itemMap.set(norm, {
            item_name: name,
            item_id: r.item_id || null,
            total_received: 0,
            total_expended: 0,
            remaining_qty: 0,
          });
        }

        const entry = itemMap.get(norm);
        if (!entry.item_id && r.item_id) {
          entry.item_id = r.item_id;
        }
        entry.total_received += Number(r.quantity || 0);
      });

      // Deduct matching expended quantities
      expendedData.forEach(e => {
        const name = resolveItemName(e);
        const norm = name ? name.toLowerCase() : '';
        const eItemId = e.item_id ? String(e.item_id).toLowerCase() : '';

        let matchedEntry = null;
        if (norm && itemMap.has(norm)) {
          matchedEntry = itemMap.get(norm);
        } else if (eItemId) {
          for (const entry of itemMap.values()) {
            if (entry.item_id && String(entry.item_id).toLowerCase() === eItemId) {
              matchedEntry = entry;
              break;
            }
          }
        }

        if (matchedEntry) {
          matchedEntry.total_expended += Number(e.quantity || 0);
        }
      });

      // Compute remaining balance strictly for items with received history
      const computedList = Array.from(itemMap.values())
        .filter(item => item.total_received > 0)
        .map(item => ({
          ...item,
          remaining_qty: item.total_received - item.total_expended
        }))
        .sort((a, b) => a.item_name.localeCompare(b.item_name));

      setRemainingList(computedList);
    } catch (err) {
      console.error('Failed to load remaining inventory:', err);
      toast.error('Failed to load remaining inventory view.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRemaining();
  }, [selectedUnitId]);

  // Summary totals for the 4 KPI cards below the table
  const summaryTotals = useMemo(() => {
    const totalItems = remainingList.length;
    let totalReceived = 0;
    let totalExpended = 0;
    let totalRemaining = 0;

    remainingList.forEach(item => {
      totalReceived += Number(item.total_received || 0);
      totalExpended += Number(item.total_expended || 0);
      totalRemaining += Number(item.remaining_qty || 0);
    });

    return { totalItems, totalReceived, totalExpended, totalRemaining };
  }, [remainingList]);

  const handleExport = () => {
    if (!remainingList.length) return;
    const exportData = remainingList.map((r, idx) => ({
      'No.': idx + 1,
      'Item': r.item_name,
      'Total Received': r.total_received,
      'Total Expended': r.total_expended,
      'Remaining Balance': r.remaining_qty,
    }));
    exportToCSV(exportData, `EDL_Remaining_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Remaining stock exported to CSV.');
  };

  const columns = [
    {
      header: 'No.',
      accessor: 'index',
      render: (row, idx) => <span className="font-mono text-slate text-xs">{idx + 1}</span>
    },
    {
      header: 'Item',
      accessor: 'item_name',
      render: (row) => (
        <span className="font-medium text-ink text-xs">{row.item_name}</span>
      )
    },
    {
      header: 'Total Received',
      accessor: 'total_received',
      tabular: true,
      align: 'right',
      render: (row) => (
        <span className="font-medium text-ink tabular-nums text-xs">
          {formatNumber(row.total_received)}
        </span>
      )
    },
    {
      header: 'Total Expended',
      accessor: 'total_expended',
      tabular: true,
      align: 'right',
      render: (row) => (
        <span className="font-medium text-ink tabular-nums text-xs">
          {formatNumber(row.total_expended)}
        </span>
      )
    },
    {
      header: 'Remaining Balance',
      accessor: 'remaining_qty',
      tabular: true,
      align: 'right',
      render: (row) => {
        const qty = Number(row.remaining_qty || 0);
        const isPositive = qty > 0;
        const isZero = qty === 0;

        let badgeClass = 'bg-ink text-white'; // dark/black badge for positive balance
        if (isZero) {
          badgeClass = 'bg-[#F4F5F7] text-slate border border-line';
        } else if (qty < 0) {
          badgeClass = 'bg-[#B4483A]/15 text-[#B4483A] border border-[#B4483A]/30';
        }

        const displaySign = isPositive ? `+${formatNumber(qty)}` : formatNumber(qty);

        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums shadow-subtle ${badgeClass}`}>
            {displaySign}
          </span>
        );
      }
    }
  ];

  return (
    <AppShell breadcrumbs={[{ label: 'Transactions', path: '/transactions' }, { label: 'Remaining' }]}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-ink tracking-tight">Remaining Inventory Balance</h1>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-surface border border-line text-slate">
              <Lock className="w-3 h-3 text-signal" />
              <span>System Derived</span>
            </span>
          </div>
        </div>

        <button
          onClick={handleExport}
          className="px-3.5 py-2 bg-card hover:bg-surface border border-line text-ink text-xs font-semibold rounded transition-colors shadow-subtle flex items-center gap-1.5 shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-signal" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Compliance Callout Note */}
      <div className="mb-4 p-3 bg-card border border-line rounded-lg flex items-center gap-3 text-xs text-slate">
        <Calculator className="w-4 h-4 text-signal shrink-0" />
        <div>
          <span className="font-medium text-ink">Reconciliation Rule: </span>
          This is a read-only view. Balances update automatically when Received or Expended records change. Remaining balances cannot be manually overwritten or edited.
        </div>
      </div>

      <DataTable
        columns={columns}
        data={remainingList}
        loading={loading}
        searchPlaceholder="Filter remaining stock by item name..."
        emptyMessage="No received stock records calculated for this unit."
      />

      {/* 4 Summary Cards below the table */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <KpiCard
          label="Total Items"
          value={summaryTotals.totalItems}
          subtext="Unique items with received history"
        />
        <KpiCard
          label="Total Received"
          value={summaryTotals.totalReceived}
          subtext="Total cumulative received across all items"
        />
        <KpiCard
          label="Total Expended"
          value={summaryTotals.totalExpended}
          subtext="Total cumulative expended across all items"
        />
        <KpiCard
          label="Total Remaining"
          value={summaryTotals.totalRemaining}
          subtext="Total cumulative net balance available"
          highlight={true}
        />
      </div>

      {/* Bottom Back Button */}
      <BackButton to="/transactions" id="btn-back-transactions" />
    </AppShell>
  );
};
