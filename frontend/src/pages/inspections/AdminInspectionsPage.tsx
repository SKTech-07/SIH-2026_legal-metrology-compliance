import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileCheck2, 
  AlertOctagon, 
  Building2,
  MoreVertical,
  Search,
  Filter
} from 'lucide-react';
import { api } from '../../services/api';
import type { Inspection, User, Store } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';

export const AdminInspectionsPage: React.FC = () => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [inspectors, setInspectors] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // New Inspection Modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [selectedInspectorId, setSelectedInspectorId] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [insRes, inspRes, storeRes] = await Promise.all([
        api.get('/inspections'),
        api.get('/users?role=INSPECTOR'),
        api.get('/stores')
      ]);
      setInspections(insRes.data);
      setInspectors(inspRes.data);
      setStores(storeRes.data);
      
      if (storeRes.data.length > 0) setSelectedStoreId(storeRes.data[0].id);
      if (inspRes.data.length > 0) setSelectedInspectorId(inspRes.data[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignSubmit = async (storeId: string, inspectorId: string, assignPriority: string, assignNotes: string) => {
    try {
      await api.post('/inspections/assign', {
        store_id: storeId,
        assigned_inspector_id: inspectorId,
        priority: assignPriority,
        notes: assignNotes
      });
      setIsAssignModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateInspection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreId || !selectedInspectorId) return;
    handleAssignSubmit(selectedStoreId, selectedInspectorId, priority, notes);
  };

  // Filtered Inspections
  const filteredInspections = useMemo(() => {
    return inspections.filter(ins => {
      const matchesSearch = 
        ins.store?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ins.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ins.inspector?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'ALL' || ins.status === statusFilter;
      const matchesPriority = priorityFilter === 'ALL' || ins.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [inspections, searchQuery, statusFilter, priorityFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <nav className="flex text-sm text-gray-500 mb-1" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-2">
              <li className="inline-flex items-center">
                <Link to="/dashboard" className="hover:text-gray-900 transition-colors">Home</Link>
              </li>
              <li>
                <div className="flex items-center">
                  <span className="mx-2 text-gray-400">/</span>
                  <span className="text-gray-900 font-medium">Inspections</span>
                </div>
              </li>
            </ol>
          </nav>
          <h1 className="text-2xl font-bold text-gray-900">
            Inspections Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage and monitor all inspection records across your jurisdiction.
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

      {/* Filters and Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col">
        {/* Filters Bar */}
        <div className="p-5 border-b border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/50 rounded-t-xl">
          <div className="relative w-full md:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by store, ID, or inspector..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow shadow-sm"
            />
          </div>
          <div className="flex items-center space-x-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-40">
              <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm appearance-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            <div className="relative flex-1 md:w-40">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm appearance-none"
              >
                <option value="ALL">All Priorities</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold border-b border-gray-200">
              <tr>
                <th className="py-3 px-5">ID</th>
                <th className="py-3 px-5">Store</th>
                <th className="py-3 px-5">Location</th>
                <th className="py-3 px-5">Inspector</th>
                <th className="py-3 px-5">Priority</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInspections.map((ins) => (
                <tr key={ins.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-5 font-mono text-xs text-gray-500">
                    {ins.code}
                  </td>
                  <td className="py-3 px-5 font-medium text-gray-900">
                    {ins.store?.name || 'N/A'}
                  </td>
                  <td className="py-3 px-5 text-gray-500">
                    {ins.store?.location || 'N/A'}
                  </td>
                  <td className="py-3 px-5">
                    {ins.inspector ? (
                      <span className="font-medium text-gray-700">{ins.inspector.full_name}</span>
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
                      title="View Details"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredInspections.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <FileCheck2 className="w-10 h-10 text-gray-300 mb-3" />
                      <p>No inspections found matching your filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
