import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/common/Button';
import { LocationTreeSelect } from '../components/verification/LocationTreeSelect';
import { PrintableVerificationTeamsReport } from '../components/verification/PrintableVerificationTeamsReport';
import { downloadVerificationTeamsDocx } from '../utils/verificationTeamsDocxGenerator';
import { exportToCSV } from '../utils/formatters';
import { analyzeLocationTree } from '../utils/verificationTreeHelper';
import {
  Users,
  CheckCircle2,
  Clock,
  Printer,
  FileDown,
  Download,
  Search,
  Filter,
  Save,
  Trash2,
  RotateCcw,
  Building2,
  MapPin,
  ChevronRight,
  AlertCircle,
  Layers,
  FileText
} from 'lucide-react';

export const VerificationTeamsPage = () => {
  const { user, can } = useAuth();
  const toast = useToast();

  const currentCalendarYear = new Date().getFullYear();
  const [year, setYear] = useState(currentCalendarYear);
  const [activeTab, setActiveTab] = useState('appointment'); // 'appointment' | 'overview'

  // Data states
  const [locationsTree, setLocationsTree] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [error, setError] = useState(null);

  // Form states for the 3-member editor
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [member1, setMember1] = useState({ name: '', designation: '' });
  const [member2, setMember2] = useState({ name: '', designation: '' });
  const [member3, setMember3] = useState({ name: '', designation: '' });
  const [formErrors, setFormErrors] = useState({});

  // Right-side list filter
  const [listSearch, setListSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'assigned' | 'pending'

  // Process tree and extract selectable nodes, path mapping, and group mapping
  const { selectableNodes, pathsMap, nodeMap, parentGroupMap } = useMemo(() => {
    return analyzeLocationTree(locationsTree);
  }, [locationsTree]);

  // Map of teams by unit_id
  const teamsByUnitId = useMemo(() => {
    const map = {};
    teams.forEach(t => {
      if (t.unit_id) {
        map[String(t.unit_id)] = t;
      }
    });
    return map;
  }, [teams]);

  // Load locations tree and teams
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [locsRes, teamsRes] = await Promise.all([
        api.get('/verification-teams/locations'),
        api.get('/verification-teams', { year })
      ]);

      if (locsRes.success) {
        setLocationsTree(locsRes.data || []);
      } else {
        throw new Error(locsRes.message || 'Failed to load locations hierarchy.');
      }

      if (teamsRes.success) {
        setTeams(teamsRes.data || []);
      }
    } catch (err) {
      console.error('Failed to load verification teams data:', err);
      setError(err.message || 'Failed to load verification locations.');
      toast.error(err.message || 'Failed to load verification locations.');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-select first selectable location once loaded if none selected
  useEffect(() => {
    if (!selectedUnitId && selectableNodes.length > 0) {
      const first = selectableNodes[0];
      const id = String(first.id || first._id);
      setSelectedUnitId(id);
    }
  }, [selectableNodes, selectedUnitId]);

  // When selected location or year changes, populate form from existing team
  useEffect(() => {
    if (!selectedUnitId) {
      setMember1({ name: '', designation: '' });
      setMember2({ name: '', designation: '' });
      setMember3({ name: '', designation: '' });
      setFormErrors({});
      return;
    }

    const currentTeam = teamsByUnitId[String(selectedUnitId)];
    if (currentTeam && Array.isArray(currentTeam.members) && currentTeam.members.length === 3) {
      setMember1({ name: currentTeam.members[0]?.name || '', designation: currentTeam.members[0]?.designation || '' });
      setMember2({ name: currentTeam.members[1]?.name || '', designation: currentTeam.members[1]?.designation || '' });
      setMember3({ name: currentTeam.members[2]?.name || '', designation: currentTeam.members[2]?.designation || '' });
    } else {
      setMember1({ name: '', designation: '' });
      setMember2({ name: '', designation: '' });
      setMember3({ name: '', designation: '' });
    }
    setFormErrors({});
  }, [selectedUnitId, teamsByUnitId, year]);

  const selectedNode = useMemo(() => {
    return nodeMap.get(String(selectedUnitId)) || null;
  }, [nodeMap, selectedUnitId]);

  const selectedPath = useMemo(() => {
    return pathsMap.get(String(selectedUnitId)) || selectedNode?.unit_name || '';
  }, [pathsMap, selectedUnitId, selectedNode]);

  const selectedTeam = useMemo(() => {
    return teamsByUnitId[String(selectedUnitId)] || null;
  }, [teamsByUnitId, selectedUnitId]);

  // Assigned locations count & progress
  const assignedCount = useMemo(() => {
    return selectableNodes.filter(n => {
      const id = String(n.id || n._id);
      const t = teamsByUnitId[id];
      return t && Array.isArray(t.members) && t.members.length === 3;
    }).length;
  }, [selectableNodes, teamsByUnitId]);

  const totalLocationsCount = selectableNodes.length;
  const progressPercent = totalLocationsCount > 0 ? Math.round((assignedCount / totalLocationsCount) * 100) : 0;

  // Filter right-side panel locations
  const filteredPanelLocations = useMemo(() => {
    return selectableNodes.filter(loc => {
      const id = String(loc.id || loc._id);
      const team = teamsByUnitId[id];
      const isAssigned = Boolean(team && Array.isArray(team.members) && team.members.length === 3);

      if (statusFilter === 'assigned' && !isAssigned) return false;
      if (statusFilter === 'pending' && isAssigned) return false;

      if (listSearch.trim()) {
        const q = listSearch.toLowerCase().trim();
        const name = String(loc.unit_name || loc.name || '').toLowerCase();
        const code = String(loc.unit_code || loc.code || '').toLowerCase();
        const path = String(loc.pathString || '').toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !path.includes(q)) return false;
      }
      return true;
    });
  }, [selectableNodes, teamsByUnitId, statusFilter, listSearch]);

  // Grouped data by parent node for Overview Table, PDF and Word export
  const groupedData = useMemo(() => {
    const groups = {};
    selectableNodes.forEach(loc => {
      const id = String(loc.id || loc._id);
      const groupName = parentGroupMap.get(id) || 'WPS-II (direct)';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push({
        ...loc,
        team: teamsByUnitId[id] || null
      });
    });
    return groups;
  }, [selectableNodes, parentGroupMap, teamsByUnitId]);

  // Form Validation & Save
  const handleSaveTeam = async (e) => {
    e?.preventDefault();
    const errors = {};

    if (!member1.name.trim()) errors.m1Name = 'Verifier 1 name is required.';
    if (!member1.designation.trim()) errors.m1Desig = 'Verifier 1 designation is required.';

    if (!member2.name.trim()) errors.m2Name = 'Verifier 2 name is required.';
    if (!member2.designation.trim()) errors.m2Desig = 'Verifier 2 designation is required.';

    if (!member3.name.trim()) errors.m3Name = 'Verifier 3 name is required.';
    if (!member3.designation.trim()) errors.m3Desig = 'Verifier 3 designation is required.';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error('Please enter all 3 team members with their names and designations.');
      return;
    }

    if (!selectedUnitId || !selectedNode) {
      toast.error('Please select an operational location.');
      return;
    }

    setSaving(true);
    setFormErrors({});

    try {
      const payload = {
        year: Number(year),
        unit_id: String(selectedUnitId),
        unit_name: selectedNode.unit_name || selectedNode.name,
        unit_path: selectedPath,
        members: [
          { name: member1.name.trim(), designation: member1.designation.trim() },
          { name: member2.name.trim(), designation: member2.designation.trim() },
          { name: member3.name.trim(), designation: member3.designation.trim() }
        ]
      };

      const res = await api.post('/verification-teams', payload);
      if (res.success && res.data) {
        toast.success(`Verification team appointed for ${selectedNode.unit_name || selectedNode.name}.`);
        setTeams(prev => {
          const filtered = prev.filter(t => !(t.year === Number(year) && String(t.unit_id) === String(selectedUnitId)));
          return [...filtered, res.data];
        });
      } else {
        throw new Error(res.message || 'Failed to save verification team.');
      }
    } catch (err) {
      console.error('Save verification team error:', err);
      toast.error(err.message || 'Failed to save verification team.');
    } finally {
      setSaving(false);
    }
  };

  // Delete team
  const handleDeleteTeam = async () => {
    if (!selectedTeam) return;
    if (!window.confirm(`Are you sure you want to remove the verification team for ${selectedNode?.unit_name}?`)) {
      return;
    }

    try {
      const res = await api.delete(`/verification-teams/${selectedUnitId}?year=${year}`);
      if (res.success) {
        toast.success(`Verification team removed for ${selectedNode?.unit_name}.`);
        setTeams(prev => prev.filter(t => !(t.year === Number(year) && String(t.unit_id) === String(selectedUnitId))));
        setMember1({ name: '', designation: '' });
        setMember2({ name: '', designation: '' });
        setMember3({ name: '', designation: '' });
      }
    } catch (err) {
      toast.error(err.message || 'Failed to delete team.');
    }
  };

  // Export handlers
  const handlePrint = () => {
    setIsPrinting(true);
    const cleanup = () => {
      setIsPrinting(false);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 2000);
    }, 100);
  };

  const handleDownloadWord = async () => {
    try {
      setIsExportingDocx(true);
      await downloadVerificationTeamsDocx(teams, groupedData, year);
      toast.success(`Verification teams appointment schedule (${year}) downloaded (.docx).`);
    } catch (err) {
      console.error('Docx export error:', err);
      toast.error('Failed to generate Word document.');
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleExportCSV = () => {
    const csvRows = [];
    const groupNames = Object.keys(groupedData).sort();

    groupNames.forEach(groupName => {
      const locs = groupedData[groupName] || [];
      locs.forEach(loc => {
        const id = String(loc.id || loc._id);
        const t = teamsByUnitId[id];
        csvRows.push({
          'Year': year,
          'Hierarchy Group': groupName,
          'Location': loc.unit_name || loc.name,
          'Unit Code': loc.unit_code || '',
          'Path': loc.pathString || '',
          'Status': t ? 'Assigned' : 'Pending',
          'Verifier 1 Name': t?.members?.[0]?.name || '',
          'Verifier 1 Designation': t?.members?.[0]?.designation || '',
          'Verifier 2 Name': t?.members?.[1]?.name || '',
          'Verifier 2 Designation': t?.members?.[1]?.designation || '',
          'Verifier 3 Name': t?.members?.[2]?.name || '',
          'Verifier 3 Designation': t?.members?.[2]?.designation || ''
        });
      });
    });

    exportToCSV(csvRows, `EDL_Verification_Teams_${year}.csv`);
    toast.success('Verification teams list exported to CSV.');
  };

  return (
    <AppShell>
      {/* Printable Report Component for window.print() */}
      <div className="hidden print:block">
        <PrintableVerificationTeamsReport year={year} groupedData={groupedData} />
      </div>

      <div className="no-print space-y-5 animate-fade-in pb-12">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-5 rounded-2xl border border-line shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-8 h-8 rounded-lg bg-maroon-tint text-maroon flex items-center justify-center font-bold">
                <Users className="w-4 h-4" />
              </span>
              <h1 className="text-xl font-bold text-ink">Verification Teams</h1>
            </div>
            <p className="text-xs text-slate">
              Appoint exactly 3 Board of Survey verification members for each operational location in Western Province South II.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Year Selector */}
            <div className="flex items-center gap-1.5 bg-surface border border-line rounded-lg px-2.5 py-1 text-xs">
              <span className="text-slate font-medium">Year:</span>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="bg-transparent font-bold text-maroon focus:outline-none cursor-pointer"
              >
                <option value={currentCalendarYear}>{currentCalendarYear}</option>
                <option value={currentCalendarYear - 1}>{currentCalendarYear - 1}</option>
                <option value={currentCalendarYear + 1}>{currentCalendarYear + 1}</option>
              </select>
            </div>

            {/* Print Button */}
            <Button
              variant="secondary"
              size="regular"
              icon={Printer}
              iconSize={15}
              onClick={handlePrint}
              title="Print official appointment schedule"
              className="!h-8"
            >
              Print Report
            </Button>

            {/* Word Download Button */}
            <Button
              variant="secondary"
              size="regular"
              icon={FileDown}
              iconSize={15}
              onClick={handleDownloadWord}
              loading={isExportingDocx}
              title="Download editable Word appointment schedule"
              className="!h-8"
            >
              Word (.docx)
            </Button>

            {/* CSV Export */}
            <Button
              variant="secondary"
              size="regular"
              icon={Download}
              iconSize={15}
              onClick={handleExportCSV}
              title="Export all locations to CSV"
              className="!h-8"
            >
              Export CSV
            </Button>
          </div>
        </div>

        {/* Progress Summary Card */}
        <div className="bg-card p-4 rounded-xl border border-line shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-signal/10 text-signal flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-ink">
                  {assignedCount} of {totalLocationsCount} Locations Appointed
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-signal/15 text-signal">
                  {progressPercent}% Complete
                </span>
              </div>
              <p className="text-xs text-slate">
                {totalLocationsCount - assignedCount > 0
                  ? `${totalLocationsCount - assignedCount} locations still pending 3-member verification team assignment.`
                  : 'All operational locations have completed verification teams appointed.'}
              </p>
            </div>
          </div>

          {/* Mini Progress Bar */}
          <div className="w-full sm:w-64">
            <div className="w-full bg-surface rounded-full h-2.5 overflow-hidden border border-line">
              <div
                className="bg-maroon h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Navigation Tabs: Appointment Editor vs Overview Table */}
        <div className="flex items-center gap-2 border-b border-line pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('appointment')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'appointment'
                ? 'bg-maroon text-white shadow-2xs'
                : 'text-slate hover:text-ink hover:bg-surface'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Team Appointment</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-maroon text-white shadow-2xs'
                : 'text-slate hover:text-ink hover:bg-surface'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Overview Table ({totalLocationsCount})</span>
          </button>
        </div>

        {/* TAB 1: Team Appointment (Split View) */}
        {activeTab === 'appointment' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Form Editor (7 cols) */}
            <div className="lg:col-span-7 bg-card p-5 rounded-2xl border border-line shadow-xs space-y-5">
              <div>
                <h2 className="text-sm font-bold text-ink mb-1">Select Location &amp; Appoint Members</h2>
                <p className="text-xs text-slate">
                  Choose any operational location or area from the organizational hierarchy.
                </p>
              </div>

              {/* Location Tree Select */}
              <div>
                <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                  Location (Organizational Hierarchy) <span className="text-red-500">*</span>
                </label>
                <LocationTreeSelect
                  tree={locationsTree}
                  selectableNodes={selectableNodes}
                  pathsMap={pathsMap}
                  selectedUnitId={selectedUnitId}
                  onSelect={(node) => setSelectedUnitId(String(node.id || node._id))}
                  teamsByUnitId={teamsByUnitId}
                  disabled={saving}
                />
              </div>

              {/* Status Banner for Selected Location */}
              <div className="p-3 bg-surface/60 rounded-xl border border-line flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {selectedTeam ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span className="font-semibold text-ink">
                    {selectedTeam
                      ? `Team Appointed for ${selectedNode?.unit_name || 'Unit'}`
                      : `Pending Appointment for ${selectedNode?.unit_name || 'Unit'}`}
                  </span>
                </div>
                {selectedTeam && (
                  <button
                    type="button"
                    onClick={handleDeleteTeam}
                    className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-800 hover:underline cursor-pointer font-medium"
                    title="Remove appointed team"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {/* 3 Members Form */}
              <form onSubmit={handleSaveTeam} className="space-y-4">
                <div className="border-t border-line pt-4 space-y-4">
                  {/* Member 1 */}
                  <div className="p-3.5 bg-surface/40 rounded-xl border border-line/70 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-maroon flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-maroon text-white text-[10px] flex items-center justify-center font-bold">1</span>
                        Verifier 1 (Team Leader)
                      </span>
                      <span className="text-[10px] text-slate font-medium">Required</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate mb-1">Full Name</label>
                        <input
                          type="text"
                          value={member1.name}
                          onChange={(e) => setMember1(p => ({ ...p, name: e.target.value }))}
                          placeholder="e.g. H.M. Karunaratne"
                          className={`w-full h-8 px-2.5 text-xs bg-card border rounded-lg focus:outline-none focus:border-signal text-ink ${
                            formErrors.m1Name ? 'border-red-400 ring-1 ring-red-400/20' : 'border-line'
                          }`}
                        />
                        {formErrors.m1Name && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.m1Name}</p>}
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate mb-1">Designation</label>
                        <input
                          type="text"
                          value={member1.designation}
                          onChange={(e) => setMember1(p => ({ ...p, designation: e.target.value }))}
                          placeholder="e.g. Chief Audit Officer"
                          className={`w-full h-8 px-2.5 text-xs bg-card border rounded-lg focus:outline-none focus:border-signal text-ink ${
                            formErrors.m1Desig ? 'border-red-400 ring-1 ring-red-400/20' : 'border-line'
                          }`}
                        />
                        {formErrors.m1Desig && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.m1Desig}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Member 2 */}
                  <div className="p-3.5 bg-surface/40 rounded-xl border border-line/70 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-maroon flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-maroon text-white text-[10px] flex items-center justify-center font-bold">2</span>
                        Verifier 2
                      </span>
                      <span className="text-[10px] text-slate font-medium">Required</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate mb-1">Full Name</label>
                        <input
                          type="text"
                          value={member2.name}
                          onChange={(e) => setMember2(p => ({ ...p, name: e.target.value }))}
                          placeholder="e.g. S.D. Wijesinghe"
                          className={`w-full h-8 px-2.5 text-xs bg-card border rounded-lg focus:outline-none focus:border-signal text-ink ${
                            formErrors.m2Name ? 'border-red-400 ring-1 ring-red-400/20' : 'border-line'
                          }`}
                        />
                        {formErrors.m2Name && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.m2Name}</p>}
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate mb-1">Designation</label>
                        <input
                          type="text"
                          value={member2.designation}
                          onChange={(e) => setMember2(p => ({ ...p, designation: e.target.value }))}
                          placeholder="e.g. Electrical Engineer"
                          className={`w-full h-8 px-2.5 text-xs bg-card border rounded-lg focus:outline-none focus:border-signal text-ink ${
                            formErrors.m2Desig ? 'border-red-400 ring-1 ring-red-400/20' : 'border-line'
                          }`}
                        />
                        {formErrors.m2Desig && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.m2Desig}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Member 3 */}
                  <div className="p-3.5 bg-surface/40 rounded-xl border border-line/70 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-maroon flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-maroon text-white text-[10px] flex items-center justify-center font-bold">3</span>
                        Verifier 3
                      </span>
                      <span className="text-[10px] text-slate font-medium">Required</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate mb-1">Full Name</label>
                        <input
                          type="text"
                          value={member3.name}
                          onChange={(e) => setMember3(p => ({ ...p, name: e.target.value }))}
                          placeholder="e.g. R.K. Bandara"
                          className={`w-full h-8 px-2.5 text-xs bg-card border rounded-lg focus:outline-none focus:border-signal text-ink ${
                            formErrors.m3Name ? 'border-red-400 ring-1 ring-red-400/20' : 'border-line'
                          }`}
                        />
                        {formErrors.m3Name && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.m3Name}</p>}
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate mb-1">Designation</label>
                        <input
                          type="text"
                          value={member3.designation}
                          onChange={(e) => setMember3(p => ({ ...p, designation: e.target.value }))}
                          placeholder="e.g. Storekeeper / Technical Officer"
                          className={`w-full h-8 px-2.5 text-xs bg-card border rounded-lg focus:outline-none focus:border-signal text-ink ${
                            formErrors.m3Desig ? 'border-red-400 ring-1 ring-red-400/20' : 'border-line'
                          }`}
                        />
                        {formErrors.m3Desig && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.m3Desig}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-line">
                  <button
                    type="button"
                    onClick={() => {
                      setMember1({ name: '', designation: '' });
                      setMember2({ name: '', designation: '' });
                      setMember3({ name: '', designation: '' });
                      setFormErrors({});
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate hover:text-ink hover:bg-surface rounded-lg border border-line cursor-pointer"
                  >
                    Clear Fields
                  </button>

                  <Button
                    variant="primary"
                    size="regular"
                    icon={Save}
                    iconSize={15}
                    type="submit"
                    loading={saving}
                    className="!h-9 !px-5"
                  >
                    Save Verification Team
                  </Button>
                </div>
              </form>
            </div>

            {/* Right Column: "All Locations" Panel (5 cols) */}
            <div className="lg:col-span-5 bg-card p-4 rounded-2xl border border-line shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <div>
                  <h3 className="text-sm font-bold text-ink">All Locations ({selectableNodes.length})</h3>
                  <p className="text-[11px] text-slate">Hierarchy tree order with appointment status</p>
                </div>
              </div>

              {/* Filter Row */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate" />
                  <input
                    type="text"
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                    placeholder="Search locations..."
                    className="w-full h-8 pl-8 pr-3 text-xs bg-surface border border-line rounded-lg focus:outline-none focus:border-signal text-ink placeholder-slate"
                  />
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-2 py-0.5 rounded cursor-pointer font-medium ${
                      statusFilter === 'all' ? 'bg-maroon text-white' : 'text-slate hover:bg-surface'
                    }`}
                  >
                    All ({selectableNodes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('assigned')}
                    className={`px-2 py-0.5 rounded cursor-pointer font-medium ${
                      statusFilter === 'assigned' ? 'bg-emerald-600 text-white' : 'text-slate hover:bg-surface'
                    }`}
                  >
                    Assigned ({assignedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('pending')}
                    className={`px-2 py-0.5 rounded cursor-pointer font-medium ${
                      statusFilter === 'pending' ? 'bg-amber-600 text-white' : 'text-slate hover:bg-surface'
                    }`}
                  >
                    Pending ({totalLocationsCount - assignedCount})
                  </button>
                </div>
              </div>

              {/* Locations List */}
              <div className="max-h-[520px] overflow-y-auto space-y-1 pr-1">
                {filteredPanelLocations.length > 0 ? (
                  filteredPanelLocations.map(loc => {
                    const id = String(loc.id || loc._id);
                    const team = teamsByUnitId[id];
                    const isAssigned = Boolean(team && Array.isArray(team.members) && team.members.length === 3);
                    const isSelected = selectedUnitId === id;

                    return (
                      <div
                        key={id}
                        onClick={() => setSelectedUnitId(id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-maroon-tint/80 border-maroon text-ink font-semibold ring-1 ring-maroon/30 shadow-2xs'
                            : 'bg-card hover:bg-surface border-line/60 hover:border-slate/40 text-ink'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {/* Status Dot */}
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isAssigned ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-amber-400 ring-2 ring-amber-100'
                            }`}
                          />

                          {loc.unit_type === 'csc' ? (
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : loc.children && loc.children.length > 0 ? (
                            <Building2 className="w-3.5 h-3.5 text-[#3A6D8C] shrink-0" />
                          ) : (
                            <Building2 className="w-3.5 h-3.5 text-slate shrink-0" />
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="text-xs truncate font-medium">{loc.unit_name || loc.name}</p>
                            <p className="text-[10px] text-slate truncate font-mono">{loc.pathString}</p>
                          </div>
                        </div>

                        {/* Member Count Pill (3/3 or 0/3) */}
                        <div className="shrink-0 pl-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                              isAssigned
                                ? 'bg-emerald-100/70 text-emerald-800'
                                : 'bg-amber-100/70 text-amber-800'
                            }`}
                          >
                            {isAssigned ? '3/3' : '0/3'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-xs text-slate italic">
                    No matching locations in this view.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Overview Table (Grouped by Parent Hierarchy Node) */}
        {activeTab === 'overview' && (
          <div className="bg-card rounded-2xl border border-line shadow-xs overflow-hidden">
            <div className="p-4 bg-surface/50 border-b border-line flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-ink">Annual Verification Teams Overview — {year}</h3>
                <p className="text-xs text-slate">
                  Complete status of all {totalLocationsCount} locations grouped dynamically by parent hierarchy node.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {assignedCount} Appointed
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                  {totalLocationsCount - assignedCount} Pending
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs text-left">
                <thead>
                  <tr className="bg-surface text-ink font-bold text-[11px] uppercase tracking-wider border-b border-line">
                    <th className="py-2.5 px-3 w-12 text-center">No.</th>
                    <th className="py-2.5 px-3">Location / Unit</th>
                    <th className="py-2.5 px-3 w-28 text-center">Status</th>
                    <th className="py-2.5 px-3">Verifier 1</th>
                    <th className="py-2.5 px-3">Verifier 2</th>
                    <th className="py-2.5 px-3">Verifier 3</th>
                    <th className="py-2.5 px-3 w-20 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {Object.keys(groupedData).sort((a, b) => (a.includes('direct') ? -1 : a.localeCompare(b))).map((groupName, gIdx) => {
                    const locs = groupedData[groupName] || [];
                    const groupAssigned = locs.filter(l => l.team && l.team.members?.length === 3).length;

                    return (
                      <React.Fragment key={groupName}>
                        {/* Dynamic Hierarchy Group Heading */}
                        <tr className="bg-maroon-tint/50 text-maroon font-bold">
                          <td colSpan={7} className="py-2 px-3 text-xs tracking-wide">
                            <div className="flex items-center justify-between">
                              <span>HIERARCHY GROUP: {groupName.toUpperCase()}</span>
                              <span className="text-[11px] font-mono font-medium">
                                {groupAssigned} of {locs.length} assigned
                              </span>
                            </div>
                          </td>
                        </tr>

                        {locs.map((loc, lIdx) => {
                          const id = String(loc.id || loc._id);
                          const team = loc.team;
                          const isAssigned = Boolean(team && Array.isArray(team.members) && team.members.length === 3);
                          const m1 = team?.members?.[0];
                          const m2 = team?.members?.[1];
                          const m3 = team?.members?.[2];

                          return (
                            <tr key={id} className="hover:bg-surface/40 transition-colors">
                              <td className="py-2 px-3 text-center text-slate font-mono text-[11px]">
                                {lIdx + 1}
                              </td>
                              <td className="py-2 px-3">
                                <div className="font-semibold text-ink flex items-center gap-1.5">
                                  {loc.unit_type === 'csc' ? (
                                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  ) : (
                                    <Building2 className="w-3.5 h-3.5 text-slate shrink-0" />
                                  )}
                                  <span>{loc.unit_name || loc.name}</span>
                                </div>
                                <div className="text-[10px] text-slate font-mono truncate max-w-xs">{loc.pathString}</div>
                              </td>
                              <td className="py-2 px-3 text-center">
                                {isAssigned ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    Done 3/3
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                    <Clock className="w-2.5 h-2.5" />
                                    Pending
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                {m1 ? (
                                  <div>
                                    <p className="font-semibold text-ink">{m1.name}</p>
                                    <p className="text-[10px] text-slate">{m1.designation}</p>
                                  </div>
                                ) : (
                                  <span className="text-slate/60 italic">—</span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                {m2 ? (
                                  <div>
                                    <p className="font-semibold text-ink">{m2.name}</p>
                                    <p className="text-[10px] text-slate">{m2.designation}</p>
                                  </div>
                                ) : (
                                  <span className="text-slate/60 italic">—</span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                {m3 ? (
                                  <div>
                                    <p className="font-semibold text-ink">{m3.name}</p>
                                    <p className="text-[10px] text-slate">{m3.designation}</p>
                                  </div>
                                ) : (
                                  <span className="text-slate/60 italic">—</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedUnitId(id);
                                    setActiveTab('appointment');
                                  }}
                                  className="text-xs text-maroon hover:underline font-semibold cursor-pointer"
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default VerificationTeamsPage;
