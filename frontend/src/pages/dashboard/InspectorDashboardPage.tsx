import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  MapPin, 
  Clock, 
  AlertTriangle,
  FileCheck2,
  CheckCircle2,
  Search,
  Filter,
  ArrowRight,
  ClipboardList,
  Play
} from 'lucide-react';
import { api } from '../../services/api';
import type { Inspection } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuthStore } from '../../store/authStore';

export const InspectorDashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyInspections();
  }, []);

  const fetchMyInspections = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inspections');
      // In a real app, this would be pre-filtered by the backend
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

  const assignedCount = inspections.filter(i => i.status === 'ASSIGNED').length;
  const inProgressCount = inspections.filter(i => i.status === 'IN_PROGRESS').length;
  const completedCount = inspections.filter(i => i.status === 'COMPLETED').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="flex text-sm text-gray-500 mb-1" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-2">
              <li className="inline-flex items-center">
                <Link to="/dashboard" className="hover:text-gray-900 transition-colors">Home</Link>
              </li>
              <li>
                <div className="flex items-center">
                  <span className="mx-2 text-gray-400">/</span>
                  <span className="text-gray-900 font-medium">Dashboard</span>
                </div>
              </li>
            </ol>
          </nav>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.full_name}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Here's what's happening with your assigned inspections today.
          </p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-gray-900">{assignedCount}</div>
            <div className="text-sm font-medium text-gray-500 mt-1">Pending Assignments</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-gray-900">{inProgressCount}</div>
            <div className="text-sm font-medium text-gray-500 mt-1">In Progress</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-gray-900">{completedCount}</div>
            <div className="text-sm font-medium text-gray-500 mt-1">Completed</div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Immediate Workload */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">
              Next Up (My Assignments)
            </h3>
            <Link to="/inspections" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              View All →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inspections.slice(0, 4).map((ins) => (
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
                    <p className="text-sm text-gray-500 mt-2 line-clamp-1">{ins.notes || 'Routine compliance audit.'}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs font-medium text-gray-600 pt-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded bg-gray-50 border border-gray-100 ${
                      ins.priority === 'HIGH' || ins.priority === 'URGENT' ? 'text-rose-600 bg-rose-50 border-rose-100' : ''
                    }`}>
                      Priority: {ins.priority}
                    </span>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-gray-100 flex justify-end relative z-10">
                  {ins.status === 'ASSIGNED' ? (
                    <button
                      onClick={() => handleStartInspection(ins.id)}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex justify-center items-center"
                    >
                      <Play className="w-4 h-4 mr-1.5 fill-current" /> Start
                    </button>
                  ) : (
                    <Link
                      to={`/inspections/${ins.id}`}
                      className="w-full py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors flex justify-center items-center"
                    >
                      Workspace <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
            {inspections.length === 0 && (
              <div className="col-span-full py-8 text-center bg-white border border-gray-200 rounded-xl">
                <FileCheck2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <h3 className="text-sm font-medium text-gray-900">No Assignments</h3>
                <p className="text-xs text-gray-500 mt-1">You're all caught up for today.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Schedule and Activity */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 flex items-center">
                <Clock className="w-4 h-4 mr-2 text-blue-600" /> Today's Schedule
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {inspections.filter(i => i.status === 'ASSIGNED').slice(0, 3).map((ins, idx) => (
                <div key={ins.id} className="flex space-x-3">
                  <div className="text-xs font-bold text-gray-500 w-14 pt-0.5">TBD</div>
                  <div className={`flex-1 border-l-2 pl-3 pb-3 ${idx === 0 ? 'border-blue-200' : 'border-gray-200'}`}>
                    <div className="text-sm font-bold text-gray-900">{ins.store?.name || 'Unknown Store'}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{ins.priority} Priority</div>
                  </div>
                </div>
              ))}
              {inspections.filter(i => i.status === 'ASSIGNED').length === 0 && (
                <div className="text-sm text-gray-500 text-center py-4">No scheduled inspections today.</div>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" /> Recent Activity
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {inspections.filter(i => i.status !== 'ASSIGNED').slice(0, 3).map(ins => (
                <div key={ins.id} className="text-sm">
                  <span className="font-bold text-gray-900">Inspection {ins.status.toLowerCase()}</span> at {ins.store?.name || 'Store'}
                  <div className="text-xs text-gray-400 mt-0.5">#{ins.code}</div>
                </div>
              ))}
              {inspections.filter(i => i.status !== 'ASSIGNED').length === 0 && (
                <div className="text-sm text-gray-500 text-center py-4">No recent activity.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

