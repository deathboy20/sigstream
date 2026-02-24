import { Toaster } from './components/ui/toaster';
import { Toaster as Sonner } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import HostDashboard from "./pages/HostDashboard";
import ViewerPage from "./pages/ViewerPage";
import WelcomePage from "./pages/WelcomePage";
import MeetDashboard from "./pages/MeetDashboard";
import MeetRoom from "./pages/MeetRoom";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            {/* Welcome Landing Page */}
            <Route path="/" element={<WelcomePage />} />
            
            {/* Streaming Routes */}
            <Route path="/stream" element={<HostDashboard />} />
            <Route path="/host" element={<Navigate to="/stream" replace />} />
            <Route path="/join" element={<ViewerPage />} />
            <Route path="/join/:sessionId" element={<ViewerPage />} />
            <Route path="/session/:sessionId" element={<ViewerPage />} /> 

            {/* Soko Meet Routes */}
            <Route path="/meet" element={<MeetDashboard />} />
            <Route path="/meet/:meetingId" element={<MeetRoom />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
