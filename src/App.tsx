import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { RegisterDealer } from './pages/RegisterDealer';
import { DealerDashboard } from './pages/DealerDashboard';
import { SalesDashboard } from './pages/SalesDashboard';
import { DriverDashboard } from './pages/DriverDashboard';
import { Chat } from './pages/Chat';
import { AllConversations } from './pages/AllConversations';
import { Profile } from './pages/Profile';
import { SignUpSales } from './pages/SignUpSales';
import { SignUpDriver } from './pages/SignUpDriver';
import { CompleteProfile } from './pages/CompleteProfile';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    const dashboardPath = role === 'dealer' ? '/dealer' : role === 'sales' ? '/sales' : '/driver';
    return <Navigate to={dashboardPath} replace />;
  }

  return <>{children}</>;
}

function RootRedirect() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (user && role) {
    const dashboardPath = role === 'dealer' ? '/dealer' : role === 'sales' ? '/sales' : '/driver';
    return <Navigate to={dashboardPath} replace />;
  }

  return <Landing />;
}

function AppContent() {
  return (
    <div className="flex flex-col min-h-screen">
      <OfflineBanner />
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/register-dealer" element={<RegisterDealer />} />
          <Route path="/signup-sales" element={<SignUpSales />} />
          <Route path="/signup-driver" element={<SignUpDriver />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />

          <Route
            path="/complete-profile"
            element={
              <ProtectedRoute>
                <CompleteProfile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dealer"
            element={
              <ProtectedRoute allowedRoles={['dealer']}>
                <DealerDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/sales"
            element={
              <ProtectedRoute allowedRoles={['sales']}>
                <SalesDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/driver"
            element={
              <ProtectedRoute allowedRoles={['driver']}>
                <DriverDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/conversations"
            element={
              <ProtectedRoute allowedRoles={['driver', 'sales']}>
                <AllConversations />
              </ProtectedRoute>
            }
          />

          <Route
            path="/chat/:deliveryId"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
