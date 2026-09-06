import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, Download, Clock, Search, Filter } from 'lucide-react';
import { api } from '../../services/api';
import type { Report } from '../../types';

export const ReportsPage: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports');
      setReports(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
                  <span className="text-gray-900 font-medium">Reports</span>
                </div>
              </li>
            </ol>
          </nav>
          <h1 className="text-2xl font-bold text-gray-900">
            Compliance Reports
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Access and download historical legal metrology inspection reports.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col">
        <div className="p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
            <FileSpreadsheet className="w-5 h-5 mr-2 text-blue-600" />
            Report Archive
          </h3>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search reports..."
                className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white transition-colors"
              />
            </div>
            <button className="p-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors bg-white shrink-0 shadow-sm">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold border-b border-gray-200">
              <tr>
                <th className="py-3 px-5">Report Title</th>
                <th className="py-3 px-5">Format</th>
                <th className="py-3 px-5">Generated Timestamp</th>
                <th className="py-3 px-5 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-5 font-medium text-gray-900">{r.title}</td>
                  <td className="py-3 px-5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                      {r.report_format}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-gray-600 flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-5 text-right">
                    <a
                      href={`http://localhost:8000${r.file_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md font-medium text-xs inline-flex items-center transition-colors shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                    </a>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-500">
                    <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium">No reports generated yet.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
