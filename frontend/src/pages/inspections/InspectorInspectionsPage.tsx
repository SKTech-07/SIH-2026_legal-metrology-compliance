import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileCheck2, 
  Search,
  Filter,
  ArrowRight,
  Play
} from 'lucide-react';
import { api } from '../../services/api';
import type { Inspection } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuthStore } from '../../store/authStore';

export const InspectorInspectionsPage: React.FC = () => {
  const { user } = useAuthStore();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  useEffect(() => {
    fetchMyInspections();
  }, []);

  const fetchMyInspections = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inspections');
      const myInspections = res.data.filter(
        (ins: Inspection) => ins.assigned_inspector_id === user?.id
      );
      setInspections(myInspections);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartInspection = async (id: string) => {
    try {
      await api.post(`/inspections/${id}/start`);
      fetchMyInspections();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredInspections = useMemo(() => {
    return inspections.filter(ins => {
      const matchesSearch = 
        ins.store?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ins.code?.toLowerCase().includes(searchQuery.toLowerCase());
      
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
            My Inspections
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage and complete your assigned inspections.
          </p>
        </div>
      </div>

      {/* Filters and Grid */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col">
        {/* Filters Bar */}
        <div className="p-5 border-b border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/50 rounded-t-xl">
          <div className="relative w-full md:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by store or ID..."
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

        {/* Inspections Grid */}
        <div className="p-5 bg-gray-50/30">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInspections.map((ins) => (
              <div
                key={ins.id}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
              >
                <div className="space-y-4 relative z-10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 tracking-wider">#{ins.code}</span>
                    <StatusBadge status={ins.status} size="sm" />
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-gray-900 flex items-start leading-snug">
                      {ins.store?.name || 'Establishment'}
                    </h4>
                    <p className="text-sm text-gray-500 mt-2 line-clamp-2">{ins.notes || 'Routine compliance audit.'}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs font-medium text-gray-600 pt-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded bg-gray-50 border border-gray-100 ${
                      ins.priority === 'HIGH' || ins.priority === 'URGENT' ? 'text-rose-600 bg-rose-50 border-rose-100' : ''
                    }`}>
                      Priority: {ins.priority}
                    </span>
                    <span className="inline-flex items-center px-2 py-1 rounded bg-gray-50 border border-gray-100">
                      Items: {ins.product_count}
                    </span>
                  </div>
                </div>

                <div className="pt-5 mt-5 border-t border-gray-100 flex justify-end relative z-10">
                  {ins.status === 'ASSIGNED' ? (
                    <button
                      onClick={() => handleStartInspection(ins.id)}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex justify-center items-center"
                    >
                      <Play className="w-4 h-4 mr-1.5 fill-current" /> Start Inspection
                    </button>
                  ) : (
                    <Link
                      to={`/inspections/${ins.id}`}
                      className="w-full py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors flex justify-center items-center"
                    >
                      Open Workspace <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
            {filteredInspections.length === 0 && (
              <div className="col-span-full py-12 text-center">
                <FileCheck2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900">No Assignments Found</h3>
                <p className="text-gray-500">You don't have any pending inspections matching your criteria.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
