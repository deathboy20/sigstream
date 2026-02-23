import { Toaster } from './components/ui/toaster';
import { Toaster as Sonner } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import HostDashboard from "./pages/HostDashboard";
import ViewerPage from "./pages/ViewerPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Host Dashboard as the default landing page */}
          <Route path="/" element={<HostDashboard />} />
          {/* Keep /host for backward compatibility or direct access, or remove if strictly not needed. 
              I'll remove /host and just use / for host, as requested "open the host direct". 
              But maybe keep it as a redirect just in case? Or just have two routes point to same component.
              Let's just point / to HostDashboard. 
          */}
          <Route path="/host" element={<Navigate to="/" replace />} />
          
          <Route path="/join" element={<ViewerPage />} />
          <Route path="/join/:sessionId" element={<ViewerPage />} />
          <Route path="/session/:sessionId" element={<ViewerPage />} /> 
          {/* Added /session/:sessionId as I noticed SharePanel uses /session/ in previous turns */}
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
