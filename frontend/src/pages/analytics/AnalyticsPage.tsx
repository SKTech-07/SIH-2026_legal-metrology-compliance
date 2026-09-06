import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle2, PieChart as PieChartIcon } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { api } from '../../services/api';

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.get('/analytics/dashboard');
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return <div className="p-8 text-center text-gray-500">Loading Legal Metrology Analytics...</div>;
  }

  const COLORS = ['#10B981', '#EF4444', '#F59E0B'];

  const pieData = [
    { name: 'Pass Rate', value: data.kpis.passed_products || 0 },
    { name: 'Fail Violations', value: data.kpis.failed_products || 0 },
    { name: 'Review States', value: data.kpis.review_products || 0 },
  ];

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
                  <span className="text-gray-900 font-medium">Analytics</span>
                </div>
              </li>
            </ol>
          </nav>
          <h1 className="text-2xl font-bold text-gray-900">
            Enforcement Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Packaged commodity compliance trends and violation statistics.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Trend Chart */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
              Monthly Compliance Trends
            </h3>
          </div>
          <div className="p-5 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.compliance_trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="month" stroke="#64748B" tick={{fill: '#64748B', fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748B" tick={{fill: '#64748B', fontSize: 12}} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                  itemStyle={{ color: '#1E293B', fontWeight: 500 }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="passed" fill="#10B981" name="Passed" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="failed" fill="#EF4444" name="Violations" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="review" fill="#F59E0B" name="Review" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Violation Breakdown Pie Chart */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900 flex items-center">
              <PieChartIcon className="w-5 h-5 mr-2 text-blue-600" />
              Compliance Verdict Distribution
            </h3>
          </div>
          <div className="p-5 h-80 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={pieData} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={60} 
                  outerRadius={100} 
                  paddingAngle={2}
                  fill="#8884d8" 
                  dataKey="value" 
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                  itemStyle={{ color: '#1E293B', fontWeight: 500 }}
                />
                <Legend iconType="circle" verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px' }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
