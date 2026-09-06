import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { AdminDashboardPage } from './pages/dashboard/AdminDashboardPage';
import { InspectorDashboardPage } from './pages/dashboard/InspectorDashboardPage';
import { AdminInspectionsPage } from './pages/inspections/AdminInspectionsPage';
import { InspectorInspectionsPage } from './pages/inspections/InspectorInspectionsPage';
import { InspectionWorkspacePage } from './pages/inspections/InspectionWorkspacePage';
import { ProductCapturePage } from './pages/capture/ProductCapturePage';
import { ViolationsEvidencePage } from './pages/violations/ViolationsEvidencePage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = useAuthStore((state) => state.token);
  if (!token) {
    return <Navigate to="/auth/login" replace />;
  }
  return <AppLayout>{children}</AppLayout>;
};

const DashboardRouter: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  if (user?.role_name === 'ADMIN') {
    return <AdminDashboardPage />;
  }
  return <InspectorDashboardPage />;
};

const InspectionsRouter: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  if (user?.role_name === 'ADMIN') {
    return <AdminInspectionsPage />;
  }
  return <InspectorInspectionsPage />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardRouter />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inspections"
          element={
            <ProtectedRoute>
              <InspectionsRouter />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inspections/:id"
          element={
            <ProtectedRoute>
              <InspectionWorkspacePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/products/:id/capture"
          element={
            <ProtectedRoute>
              <ProductCapturePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/violations"
          element={
            <ProtectedRoute>
              <ViolationsEvidencePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}