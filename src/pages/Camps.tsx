import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Camp, CampStatus } from '../types';
import { ContextualAIPill } from '../components/ai/ContextualAIPill';
import {
  Tent,
  Search,
  Plus,
  Filter,
  Download,
  Edit2,
  Trash2,
  Eye,
  AlertCircle,
  X,
  Users,
  CheckCircle,
} from 'lucide-react';

export const Camps: React.FC = () => {
  const { selectedDistrict, openDrawerWithNeed, refreshData, addToast, userRole } = useApp();
  const [camps, setCamps] = useState<Camp[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingCamp, setEditingCamp] = useState<Camp | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    district: 'Sukkur',
    capacity: 1000,
    current_families: 0,
    status: 'Active' as CampStatus,
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchCamps = async () => {
    setIsLoading(true);
    try {
      const data = await api.getCamps({
        district: selectedDistrict,
        status: statusFilter,
        search: search.trim() || undefined,
      });
      setCamps(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCamps();
  }, [selectedDistrict, statusFilter, search]);

  const handleOpenCreate = () => {
    setEditingCamp(null);
    setFormData({
      name: '',
      district: selectedDistrict !== 'all' ? selectedDistrict : 'Sukkur',
      capacity: 1000,
      current_families: 0,
      status: 'Active',
      notes: '',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (camp: Camp) => {
    setEditingCamp(camp);
    setFormData({
      name: camp.name,
      district: camp.district,
      capacity: camp.capacity,
      current_families: camp.current_families,
      status: camp.status,
      notes: camp.notes || '',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cap = Number(formData.capacity);
    const fam = Number(formData.current_families);

    if (!formData.name.trim()) {
      setFormError('Camp name is required.');
      return;
    }
    if (isNaN(cap) || cap <= 0) {
      setFormError('Capacity must be a positive number.');
      return;
    }
    if (isNaN(fam) || fam < 0) {
      setFormError('Current families cannot be negative.');
      return;
    }
    if (fam > cap) {
      setFormError(`Current families (${fam}) cannot exceed total camp capacity (${cap}).`);
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCamp) {
        await api.updateCamp(editingCamp.id, formData);
        addToast({
          type: 'success',
          title: 'Camp Updated',
          message: `Camp "${formData.name}" was updated successfully.`,
        });
      } else {
        await api.createCamp(formData);
        addToast({
          type: 'success',
          title: 'Camp Created',
          message: `Camp "${formData.name}" registered in ${formData.district}.`,
        });
      }
      setIsFormOpen(false);
      await fetchCamps();
      await refreshData();
    } catch (err: any) {
      setFormError(err.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCamp = async (camp: Camp) => {
    if (!window.confirm(`Are you sure you want to delete camp "${camp.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.deleteCamp(camp.id);
      addToast({
        type: 'success',
        title: 'Camp Deleted',
        message: `Camp "${camp.name}" deleted.`,
      });
      await fetchCamps();
      await refreshData();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Cannot Delete Camp',
        message: err.message || 'Failed to delete camp.',
      });
    }
  };

  const handleExportCSV = () => {
    if (camps.length === 0) return;
    const headers = ['ID', 'Name', 'District', 'Capacity', 'Current Families', 'Status', 'Notes'];
    const rows = camps.map((c) => [
      c.id,
      `"${c.name}"`,
      `"${c.district}"`,
      c.capacity,
      c.current_families,
      c.status,
      `"${(c.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reliefhub-camps-${selectedDistrict}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const inspectCampNeed = async (camp: Camp) => {
    try {
      const campDetails = await api.getCampById(camp.id);
      if (campDetails.needs && campDetails.needs.length > 0) {
        openDrawerWithNeed(campDetails.needs[0]);
      } else {
        addToast({
          type: 'info',
          title: 'No Active Needs',
          message: `Camp "${camp.name}" has no registered needs at this time.`,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-copper">
            <Tent className="w-3.5 h-3.5" />
            <span>Shelter & Registry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-ink mt-1">
            Camp Management & Passports
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Coordinate flood-relief camps, shelter capacities, and need passports across Sindh.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <ContextualAIPill
            prompt="Summarize camp capacities, current occupancy, and high-vulnerability camps."
            label="Summarize Camps Status"
            agentType="operations_summary"
          />
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface hover:bg-canvas border border-border rounded-md text-xs font-semibold text-ink transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-ink-muted" />
            <span>Export CSV</span>
          </button>

          {userRole === 'Operations Coordinator' && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-copper hover:bg-copper-hover text-white rounded-md text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register New Camp</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-surface p-4 rounded-lg border border-border shadow-card flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search camp by name or district..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-canvas/40 border border-border rounded text-xs text-ink focus:border-copper focus:ring-1 focus:ring-copper"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-ink-muted" />
          <span className="text-ink-muted font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-canvas/50 border border-border rounded px-2.5 py-1 text-xs font-semibold text-ink cursor-pointer focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Full">Full</option>
            <option value="Closed">Closed</option>
          </select>

          {(search || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              className="text-[11px] text-copper hover:underline font-semibold ml-2"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Camps List / Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-ink-muted">
          <span className="w-6 h-6 border-2 border-copper/30 border-t-copper rounded-full animate-spin inline-block mb-2"></span>
          <p>Loading camp registry...</p>
        </div>
      ) : camps.length === 0 ? (
        <div className="bg-surface p-12 text-center rounded-lg border border-border">
          <Tent className="w-8 h-8 text-ink-faint mx-auto mb-2" />
          <h3 className="text-sm font-bold text-ink">No camps found</h3>
          <p className="text-xs text-ink-muted mt-1">Try adjusting your district or search filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {camps.map((camp) => {
            const occupancyPct =
              camp.capacity > 0 ? Math.round((camp.current_families / camp.capacity) * 100) : 0;

            return (
              <div
                key={camp.id}
                className="bg-surface rounded-lg border border-border shadow-card p-5 flex flex-col justify-between hover:border-copper/50 transition group"
              >
                <div>
                  {/* Camp Status & District */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink-muted">{camp.district} District</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        camp.status === 'Active'
                          ? 'bg-teal-light text-teal border-teal-border/60'
                          : camp.status === 'Full'
                          ? 'bg-saffron-light text-saffron-hover border-saffron-border/60'
                          : 'bg-canvas text-ink-muted border-border'
                      }`}
                    >
                      {camp.status}
                    </span>
                  </div>

                  {/* Camp Name */}
                  <h3 className="text-base font-serif font-bold text-ink mt-2 group-hover:text-copper transition">
                    {camp.name}
                  </h3>

                  {/* Occupancy bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ink-muted">Families Sheltered:</span>
                      <span className="font-bold text-ink tabular-nums">
                        {camp.current_families.toLocaleString()} / {camp.capacity.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-canvas rounded-full overflow-hidden border border-border/60">
                      <div
                        style={{ width: `${Math.min(100, occupancyPct)}%` }}
                        className={`h-full transition-all ${
                          occupancyPct >= 100
                            ? 'bg-saffron'
                            : occupancyPct >= 80
                            ? 'bg-copper'
                            : 'bg-teal'
                        }`}
                      />
                    </div>
                    <div className="text-right text-[10px] text-ink-muted font-medium">
                      {occupancyPct}% capacity reached
                    </div>
                  </div>

                  {camp.notes && (
                    <p className="text-xs text-ink-light bg-canvas/40 p-2.5 rounded border border-border/60 mt-3 line-clamp-2">
                      {camp.notes}
                    </p>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="pt-4 mt-4 border-t border-border flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => inspectCampNeed(camp)}
                      className="text-xs font-semibold text-copper hover:text-copper-hover flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect Needs</span>
                    </button>
                    <ContextualAIPill
                      prompt={`Explain ${camp.name}'s outstanding supply needs, response gaps, and allocation opportunities.`}
                      label="AI Insights"
                      size="sm"
                      agentType="needs_analysis"
                      context={{ recordId: camp.id }}
                    />
                  </div>

                  {userRole === 'Operations Coordinator' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(camp)}
                        className="p-1.5 text-ink-muted hover:text-ink hover:bg-canvas rounded transition"
                        title="Edit camp"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCamp(camp)}
                        className="p-1.5 text-ink-muted hover:text-critical hover:bg-critical-light rounded transition"
                        title="Delete camp"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Camp Modal (Create / Edit) */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-surface w-full max-w-md rounded-lg border border-border shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border bg-canvas/40 flex items-center justify-between">
              <h2 className="text-lg font-serif font-bold text-ink">
                {editingCamp ? 'Edit Camp Details' : 'Register New Relief Camp'}
              </h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded text-ink-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-critical-light border border-critical-border text-critical rounded font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-ink mb-1">Camp Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Basti Noor Shah"
                  className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink focus:border-copper focus:ring-1 focus:ring-copper"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">District</label>
                  <select
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink focus:border-copper"
                  >
                    <option value="Sukkur">Sukkur</option>
                    <option value="Khairpur">Khairpur</option>
                    <option value="Ghotki">Ghotki</option>
                    <option value="SBA">Shaheed Benazirabad (SBA)</option>
                    <option value="Dadu">Dadu</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-ink mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as CampStatus })}
                    className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink focus:border-copper"
                  >
                    <option value="Active">Active</option>
                    <option value="Full">Full</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Total Capacity (Families)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink focus:border-copper text-right tabular-nums font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-ink mb-1">Current Families Sheltered</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formData.current_families}
                    onChange={(e) =>
                      setFormData({ ...formData, current_families: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink focus:border-copper text-right tabular-nums font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Field Notes / Access Conditions</label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Accessible via Highway N-5 bypass, near dry embankment..."
                  className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink focus:border-copper"
                />
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-border rounded text-ink-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-copper hover:bg-copper-hover text-white font-semibold rounded shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingCamp ? 'Update Camp' : 'Register Camp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
