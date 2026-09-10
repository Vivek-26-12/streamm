import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import PlayerPage from './pages/PlayerPage.jsx';

// Route wrapper that checks for authenticated user session
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 text-slate-400 flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-slate-700 border-t-brand-500 rounded-full animate-spin mr-3"></span>
        <span>Restoring session...</span>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

// Route wrapper for guest pages (login page)
function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 text-slate-400 flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-slate-700 border-t-brand-500 rounded-full animate-spin mr-3"></span>
        <span>Restoring session...</span>
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } 
        />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/player/:id" 
          element={
            <ProtectedRoute>
              <PlayerPage />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
