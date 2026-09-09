import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import Layout from "./components/Layout";
import { isStaff } from "./lib/roles";
import HomePage from "./pages/HomePage";
import BookingPage from "./pages/BookingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import RoutesPage from "./pages/RoutesPage";
import AddRoutePage from "./pages/AddRoutePage";
import BusesPage from "./pages/BusesPage";
import AddBusPage from "./pages/AddBusPage";
import SchedulesPage from "./pages/SchedulesPage";
import AddSchedulePage from "./pages/AddSchedulePage";
import type { ReactNode } from "react";

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
        <Route element={<Layout />}>
          <Route path="/" element={<BookingPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><StaffRoute><AdminUsersPage /></StaffRoute></ProtectedRoute>} />
          <Route path="/routes" element={<ProtectedRoute><RoutesPage /></ProtectedRoute>} />
          <Route path="/routes/add" element={<ProtectedRoute><StaffRoute><AddRoutePage /></StaffRoute></ProtectedRoute>} />
          <Route path="/buses" element={<ProtectedRoute><BusesPage /></ProtectedRoute>} />
          <Route path="/buses/add" element={<ProtectedRoute><StaffRoute><AddBusPage /></StaffRoute></ProtectedRoute>} />
          <Route path="/schedules" element={<ProtectedRoute><SchedulesPage /></ProtectedRoute>} />
          <Route path="/schedules/add" element={<ProtectedRoute><StaffRoute><AddSchedulePage /></StaffRoute></ProtectedRoute>} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}