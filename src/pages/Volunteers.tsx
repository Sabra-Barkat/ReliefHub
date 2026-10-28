import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { VolunteerWithDetails, VolunteerSkill, Camp } from '../types';
import { ContextualAIPill } from '../components/ai/ContextualAIPill';
import {
  Users,
  Search,
  Plus,
  Filter,
  Download,
  Stethoscope,
  Truck,
  Utensils,
  Car,
  HeartHandshake,
  CheckCircle,
  XCircle,
  UserCheck,
  UserX,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';

const SKILLS: VolunteerSkill[] = ['Medical', 'Logistics', 'Cooking', 'Driving', 'Counselling'];

export const Volunteers: React.FC = () => {
  const { selectedDistrict, refreshData, addToast, userRole } = useApp();

  const [volunteers, setVolunteers] = useState<VolunteerWithDetails[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [skillFilter, setSkillFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Form Modal (Register / Edit)
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingVolunteer, setEditingVolunteer] = useState<VolunteerWithDetails | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    skill: 'Medical' as VolunteerSkill,
    camp_id: '' as string | null,
    phone: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Quick Assignment Modal
  const [assigningVolunteer, setAssigningVolunteer] = useState<VolunteerWithDetails | null>(null);
  const [targetCampId, setTargetCampId] = useState<string>('');

  const fetchVolunteersAndCamps = async () => {
    setIsLoading(true);
    try {
      const [volunteersData, campsData] = await Promise.all([
        api.getVolunteers({
          skill: skillFilter,
          status: statusFilter,
          search: search.trim() || undefined,
        }),
        api.getCamps(),
      ]);
      setVolunteers(volunteersData);
      setCamps(campsData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVolunteersAndCamps();
  }, [skillFilter, statusFilter, search]);

  const handleOpenCreate = () => {
    setEditingVolunteer(null);
    setFormData({
      name: '',
      skill: 'Medical',
      camp_id: '',
      phone: '',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (vol: VolunteerWithDetails) => {
    setEditingVolunteer(vol);
    setFormData({
      name: vol.name,
      skill: vol.skill,
      camp_id: vol.camp_id || '',
      phone: vol.phone || '',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Volunteer name is required.');
      return;
    }

    if (formData.camp_id) {
      const targetCamp = camps.find((c) => c.id === formData.camp_id);
      if (targetCamp?.status === 'Closed') {
        setFormError('Closed camps cannot receive volunteer deployments.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (editingVolunteer) {
        // update
        await api.assignVolunteer(editingVolunteer.id, formData.camp_id || null);
        addToast({
          type: 'success',
          title: 'Volunteer Updated',
          message: `Record for "${formData.name}" updated.`,
        });
      } else {
        await api.createVolunteer({
          ...formData,
          camp_id: formData.camp_id || null,
        });
        addToast({
          type: 'success',
          title: 'Volunteer Registered',
          message: `Volunteer "${formData.name}" enrolled in ${formData.skill} cadre.`,
        });
      }
      setIsFormOpen(false);
      await fetchVolunteersAndCamps();
      await refreshData();
    } catch (err: any) {
      setFormError(err.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningVolunteer) return;

    if (targetCampId) {
      const camp = camps.find((c) => c.id === targetCampId);
      if (camp?.status === 'Closed') {
        addToast({
          type: 'error',
          title: 'Invalid Assignment',
          message: 'Closed camps cannot receive new volunteer assignments.',
        });
        return;
      }
    }

    try {
      await api.assignVolunteer(assigningVolunteer.id, targetCampId || null);
      addToast({
        type: 'success',
        title: targetCampId ? 'Deployment Confirmed' : 'Volunteer Stood Down',
        message: targetCampId
          ? `Assigned ${assigningVolunteer.name} to camp.`
          : `Unassigned ${assigningVolunteer.name}.`,
      });
      setAssigningVolunteer(null);
      await fetchVolunteersAndCamps();
      await refreshData();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Assignment Failed',
        message: err.message || 'Could not update assignment.',
      });
    }
  };

  const handleDeleteVolunteer = async (vol: VolunteerWithDetails) => {
    if (!window.confirm(`Remove volunteer "${vol.name}" from active registry?`)) return;

    try {
      await api.deleteVolunteer(vol.id);
      addToast({
        type: 'success',
        title: 'Volunteer Removed',
        message: `Volunteer "${vol.name}" removed from roster.`,
      });
      await fetchVolunteersAndCamps();
      await refreshData();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Cannot Remove',
        message: err.message || 'Failed to remove volunteer.',
      });
    }
  };

  const handleExportCSV = () => {
    if (volunteers.length === 0) return;
    const headers = ['ID', 'Name', 'Skill', 'Status', 'Assigned Camp', 'District', 'Phone', 'Joined Date'];
    const rows = volunteers.map((v) => [
      v.id,
      `"${v.name}"`,
      `"${v.skill}"`,
      v.camp_id ? 'DEPLOYED' : 'AVAILABLE',
      `"${v.camp?.name || 'Unassigned'}"`,
      `"${v.camp?.district || '—'}"`,
      `"${v.phone || ''}"`,
      v.joined_date || '',
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reliefhub-volunteers-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSkillIcon = (skill: VolunteerSkill) => {
    switch (skill) {
      case 'Medical':
        return <Stethoscope className="w-3.5 h-3.5 text-critical" />;
      case 'Logistics':
        return <Truck className="w-3.5 h-3.5 text-copper" />;
      case 'Cooking':
        return <Utensils className="w-3.5 h-3.5 text-saffron-hover" />;
      case 'Driving':
        return <Car className="w-3.5 h-3.5 text-ink-light" />;
      case 'Counselling':
        return <HeartHandshake className="w-3.5 h-3.5 text-teal" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-copper">
            <Users className="w-3.5 h-3.5" />
            <span>Humanitarian Workforce</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-ink mt-1">
            Volunteer Registry & Deployments
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Volunteers are assigned to at most one camp. Closed camps cannot receive deployments.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <ContextualAIPill
            prompt="Show all unassigned volunteers grouped by skill and assess staffing availability for medical and logistics needs."
            label="Staffing Availability"
            agentType="operations_summary"
          />
          <ContextualAIPill
            prompt="Review active volunteer deployments across camps and check for unassigned relief cadres."
            label="Roster Audit"
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
              <span>Enroll Volunteer</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-surface p-4 rounded-lg border border-border shadow-card flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, skill, or camp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-canvas/40 border border-border rounded text-xs text-ink focus:border-copper focus:ring-1 focus:ring-copper"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-ink-muted" />
            <span className="text-ink-muted font-medium">Skill:</span>
            <select
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              className="bg-canvas/50 border border-border rounded px-2.5 py-1 text-xs font-semibold text-ink cursor-pointer focus:outline-none"
            >
              <option value="all">All Skills</option>
              {SKILLS.map((skill) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-ink-muted font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-canvas/50 border border-border rounded px-2.5 py-1 text-xs font-semibold text-ink cursor-pointer focus:outline-none"
            >
              <option value="all">All Volunteers</option>
              <option value="assigned">Deployed (Assigned)</option>
              <option value="unassigned">Available (Unassigned)</option>
            </select>
          </div>

          {(search || skillFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setSkillFilter('all');
                setStatusFilter('all');
              }}
              className="text-[11px] text-copper hover:underline font-semibold ml-1"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Volunteers Table */}
      <div className="bg-surface rounded-lg border border-border shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-ink-muted">
            <span className="w-6 h-6 border-2 border-copper/30 border-t-copper rounded-full animate-spin inline-block mb-2"></span>
            <p>Loading volunteer roster...</p>
          </div>
        ) : volunteers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-8 h-8 text-ink-faint mx-auto mb-2" />
            <h3 className="text-sm font-bold text-ink">No volunteers found</h3>
            <p className="text-xs text-ink-muted mt-1">Try resetting your skill or status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-canvas/40 text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                  <th className="py-3 px-4">Volunteer Name</th>
                  <th className="py-3 px-4">Specialization</th>
                  <th className="py-3 px-4">Assignment Status</th>
                  <th className="py-3 px-4">Assigned Relief Camp</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4 text-right">Deployment Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {volunteers.map((vol) => (
                  <tr key={vol.id} className="hover:bg-canvas/50 transition">
                    {/* Name */}
                    <td className="py-3.5 px-4 font-bold text-ink">
                      <span>{vol.name}</span>
                      <span className="block text-[10px] text-ink-muted font-mono">{vol.id}</span>
                    </td>

                    {/* Skill */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-canvas border border-border text-[11px] font-medium text-ink">
                        {getSkillIcon(vol.skill)}
                        <span>{vol.skill}</span>
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {vol.camp_id ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-light text-teal border border-teal-border/60">
                          <CheckCircle className="w-3 h-3" />
                          Deployed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-canvas text-ink-muted border border-border">
                          <XCircle className="w-3 h-3" />
                          Available
                        </span>
                      )}
                    </td>

                    {/* Camp */}
                    <td className="py-3.5 px-4 font-medium">
                      {vol.camp ? (
                        <div>
                          <span className="text-ink font-semibold">{vol.camp.name}</span>
                          <span className="text-[11px] text-ink-muted block">{vol.camp.district} District</span>
                        </div>
                      ) : (
                        <span className="text-ink-muted italic">Unassigned (Pool)</span>
                      )}
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-ink-muted">
                      {vol.phone || '—'}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {userRole === 'Operations Coordinator' && (
                          <>
                            <button
                              onClick={() => {
                                setAssigningVolunteer(vol);
                                setTargetCampId(vol.camp_id || '');
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold text-copper bg-copper-light border border-copper-border rounded hover:bg-copper hover:text-white transition"
                            >
                              {vol.camp_id ? 'Reassign' : 'Deploy'}
                            </button>
                            <button
                              onClick={() => handleDeleteVolunteer(vol)}
                              className="p-1 text-ink-muted hover:text-critical hover:bg-critical-light rounded transition"
                              title="Remove volunteer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deployment / Reassignment Modal */}
      {assigningVolunteer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-surface w-full max-w-md rounded-lg border border-border shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border bg-canvas/40 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-serif font-bold text-ink">Volunteer Deployment</h2>
                <p className="text-xs text-ink-muted">Assign {assigningVolunteer.name} ({assigningVolunteer.skill})</p>
              </div>
              <button
                onClick={() => setAssigningVolunteer(null)}
                className="p-1 rounded text-ink-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-ink mb-1">Target Relief Camp</label>
                <select
                  value={targetCampId}
                  onChange={(e) => setTargetCampId(e.target.value)}
                  className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink font-semibold focus:border-copper"
                >
                  <option value="">— Unassign (Return to reserve pool) —</option>
                  {camps
                    .filter((c) => c.status !== 'Closed')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.district}) — {c.status}
                      </option>
                    ))}
                </select>
                <span className="text-[10px] text-ink-muted mt-1 block">
                  Closed camps are filtered out and cannot receive deployments.
                </span>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAssigningVolunteer(null)}
                  className="px-4 py-2 border border-border rounded text-ink-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-copper hover:bg-copper-hover text-white font-semibold rounded shadow-sm"
                >
                  Save Deployment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Volunteer Registration Modal */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-surface w-full max-w-md rounded-lg border border-border shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border bg-canvas/40 flex items-center justify-between">
              <h2 className="text-lg font-serif font-bold text-ink">Enroll New Volunteer</h2>
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
                <label className="block font-semibold text-ink mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Dr. Tariq Soomro"
                  className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink focus:border-copper"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Primary Skill</label>
                  <select
                    value={formData.skill}
                    onChange={(e) =>
                      setFormData({ ...formData, skill: e.target.value as VolunteerSkill })
                    }
                    className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink focus:border-copper"
                  >
                    {SKILLS.map((skill) => (
                      <option key={skill} value={skill}>
                        {skill}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-ink mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+92 300 1234567"
                    className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink focus:border-copper"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Initial Camp Assignment (Optional)</label>
                <select
                  value={formData.camp_id || ''}
                  onChange={(e) => setFormData({ ...formData, camp_id: e.target.value || null })}
                  className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink focus:border-copper"
                >
                  <option value="">— Leave Unassigned (Reserve Pool) —</option>
                  {camps
                    .filter((c) => c.status !== 'Closed')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.district})
                      </option>
                    ))}
                </select>
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
                  {isSubmitting ? 'Enrolling...' : 'Enroll Volunteer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
