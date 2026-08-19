import { Toaster } from './components/ui/toaster';
import { Toaster as Sonner } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LoginPage from './pages/LoginPage';
import WelcomePage from './pages/WelcomePage';
import HostDashboard from './pages/HostDashboard';
import ViewerPage from './pages/ViewerPage';
import MeetDashboard from './pages/MeetDashboard';
import MeetRoom from './pages/MeetRoom';
import PreviewSetupPage from './pages/PreviewSetupPage';
import MeetAdminMonitor from './pages/MeetAdminMonitor';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

const RequireMeetAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, orgReady } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#070B14] text-white flex items-center justify-center">
        Loading…
      </div>
    );
  }
  if (!user || !orgReady) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/welcome" element={<WelcomePage />} />

            <Route path="/stream" element={<HostDashboard />} />
            <Route path="/host" element={<Navigate to="/stream" replace />} />
            <Route path="/join" element={<ViewerPage />} />
            <Route path="/join/:sessionId" element={<ViewerPage />} />
            <Route path="/session/:sessionId" element={<ViewerPage />} />

            <Route path="/meet" element={<RequireMeetAuth><MeetDashboard /></RequireMeetAuth>} />
            <Route path="/setup" element={<RequireMeetAuth><PreviewSetupPage /></RequireMeetAuth>} />
            <Route path="/meet/:meetingId" element={<RequireMeetAuth><MeetRoom /></RequireMeetAuth>} />
            <Route path="/admin" element={<RequireMeetAuth><MeetAdminMonitor /></RequireMeetAuth>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
