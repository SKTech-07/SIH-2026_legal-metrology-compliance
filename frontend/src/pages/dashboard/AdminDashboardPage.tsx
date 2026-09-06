import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  FileCheck2, 
  AlertOctagon, 
  UserPlus, 
  Plus, 
  CheckCircle2, 
  Clock, 
  ShieldCheck,
  Building,
  Building2,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  MoreVertical,
  MapPin,
  Search
} from 'lucide-react';
import { api } from '../../services/api';
import type { Inspection, User, Store } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuthStore } from '../../store/authStore';

export const AdminDashboardPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [inspectors, setInspectors] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [kpis, setKpis] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // New Inspection Modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [selectedInspectorId, setSelectedInspectorId] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [insRes, inspRes, storeRes, analyticsRes] = await Promise.all([
        api.get('/inspections'),
        api.get('/users?role=INSPECTOR'),
        api.get('/stores'),
        api.get('/analytics/dashboard')
      ]);
      setInspections(insRes.data);
      setInspectors(inspRes.data);
      setStores(storeRes.data);
      setKpis(analyticsRes.data.kpis);
      if (storeRes.data.length > 0) setSelectedStoreId(storeRes.data[0].id);
      if (inspRes.data.length > 0) setSelectedInspectorId(inspRes.data[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignSubmit = async (storeId: string, inspectorId: string, priority: string, notes: string) => {
    try {
      await api.post('/inspections/assign', {
        store_id: storeId,
        assigned_inspector_id: inspectorId,
        priority,
        notes
      });
      setIsAssignModalOpen(false);
      fetchAdminData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateInspection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreId || !selectedInspectorId) return;
    handleAssignSubmit(selectedStoreId, selectedInspectorId, priority, notes);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <nav className="flex text-sm text-gray-500 mb-1" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-2">
              <li className="inline-flex items-center">
                <span className="text-gray-900 font-medium">Dashboard</span>
              </li>
            </ol>
          </nav>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.full_name}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Here's what's happening across your jurisdiction today.
          </p>
        </div>
        <button
          onClick={() => setIsAssignModalOpen(true)}
          className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center justify-center"
        >
          <Building2 className="w-4 h-4 mr-2" />
          Assign New Inspection
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-gray-900">{kpis.total_inspectors || 0}</div>
            <div className="text-sm font-medium text-gray-500 mt-1">Active Inspectors</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-gray-900">{kpis.unassigned_inspections || 0}</div>
            <div className="text-sm font-medium text-gray-500 mt-1">Pending Assignments</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-gray-900">{kpis.completed_inspections || 0}</div>
            <div className="text-sm font-medium text-gray-500 mt-1">Completed Inspections</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-gray-900">{kpis.pending_violations || 0}</div>
            <div className="text-sm font-medium text-gray-500 mt-1">Critical Issues</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col">
          <div className="p-5 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <FileCheck2 className="w-5 h-5 mr-2 text-gray-400" />
              Recent Inspections
            </h3>
          </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold border-b border-gray-200">
              <tr>
                <th className="py-3 px-5">Store</th>
                <th className="py-3 px-5">Location</th>
                <th className="py-3 px-5">Inspector</th>
                <th className="py-3 px-5">Priority</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inspections.slice(0, 5).map((ins) => (
                <tr key={ins.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-5 font-medium text-gray-900">
                    {ins.store?.name || 'N/A'}
                  </td>
                  <td className="py-3 px-5 text-gray-500">
                    {ins.store?.location || 'N/A'}
                  </td>
                  <td className="py-3 px-5">
                    {ins.inspector ? (
                      <div className="flex items-center">
                        <span className="font-medium text-gray-700">{ins.inspector.full_name}</span>
                      </div>
                    ) : (
                        <span className="text-gray-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        ins.priority === 'HIGH' || ins.priority === 'URGENT' ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {ins.priority}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <StatusBadge status={ins.status} size="sm" />
                    </td>
                    <td className="py-3 px-5 text-right">
                      <Link
                        to={`/inspections/${ins.id}`}
                        className="text-gray-400 hover:text-blue-600 transition-colors inline-block p-1 rounded-md hover:bg-blue-50"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {inspections.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No inspections found.
                    </td>
                  </tr>
                )}
                {inspections.length > 5 && (
                  <tr>
                    <td colSpan={6} className="py-3 px-5 text-center bg-gray-50/50 border-t border-gray-100">
                      <Link to="/inspections" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                        View All Inspections →
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Location-based Store Selection (Sidebar equivalent for admin) */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col">
          <div className="p-5 border-b border-gray-200 flex flex-col gap-2">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-gray-400" /> Stores by Location
            </h3>
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search stores..."
                className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
              />
            </div>
          </div>
          <div className="p-0 overflow-y-auto max-h-[400px]">
            {stores.map((s) => (
              <div key={s.id} className="p-4 border-b border-gray-100 hover:bg-gray-50 flex flex-col justify-center cursor-pointer transition-colors group">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{s.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">{s.city}</p>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedStoreId(s.id);
                      setIsAssignModalOpen(true);
                    }}
                    className="text-xs bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-2 py-1 rounded"
                  >
                    Action
                  </button>
                </div>
                <div className="text-[10px] text-gray-400 mt-2 font-mono">Lic: {s.license_number}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Assign Inspection Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-white">
              <h3 className="text-lg font-bold text-gray-900">
                New Inspection
              </h3>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <AlertOctagon className="w-5 h-5 opacity-0" /> {/* Spacer or close icon */}
              </button>
            </div>

            <form onSubmit={handleCreateInspection} className="p-6 space-y-5 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1.5">Store / Location</label>
                <select
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.city}, Lic: {s.license_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1.5">Assign Inspector</label>
                <select
                  value={selectedInspectorId}
                  onChange={(e) => setSelectedInspectorId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  {inspectors.map((insp) => (
                    <option key={insp.id} value={insp.id}>
                      {insp.full_name} ({insp.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1.5">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1.5">Notes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional context or instructions for the inspector..."
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white resize-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Assign Inspection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

