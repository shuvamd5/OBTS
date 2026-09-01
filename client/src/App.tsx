import { Routes, Route, Navigate, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import { isStaff } from "./lib/roles";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import RoutesPage from "./pages/RoutesPage";
import AdminRoutesPage from "./pages/AdminRoutesPage";
import type { ReactNode } from "react";

function HomePage() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-100">
      <h1 className="text-4xl font-bold text-blue-600">OBTS</h1>
      <p>Welcome, {user?.uname}!</p>
      <Link className="text-blue-600 underline" to="/routes">
        Routes
      </Link>
      {isStaff(user) && (
        <>
          <Link className="text-blue-600 underline" to="/admin/routes">
            Manage Routes
          </Link>
          <Link className="text-blue-600 underline" to="/users">
            Manage Users
          </Link>
        </>
      )}
      <button
        onClick={() => logout()}
        className="bg-red-600 text-white rounded px-4 py-2 hover:bg-red-700"
      >
        Logout
      </button>
    </div>
  );
}

function StaffRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!isStaff(user)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute>
            <StaffRoute>
              <AdminUsersPage />
            </StaffRoute>
          </ProtectedRoute>
        } />
        <Route path="/routes" element={
          <ProtectedRoute>
            <RoutesPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/routes" element={
          <ProtectedRoute>
            <StaffRoute>
              <AdminRoutesPage />
            </StaffRoute>
          </ProtectedRoute>
        } />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}