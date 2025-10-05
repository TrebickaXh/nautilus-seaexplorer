import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import TaskRoutines from "./pages/TaskRoutines";
import Schedules from "./pages/Schedules";
import Shifts from "./pages/Shifts";
import TaskInstances from "./pages/TaskInstances";
import Locations from "./pages/Locations";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Kiosk from "./pages/Kiosk";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
          <Route path="/kiosk" element={<Kiosk />} />
          <Route path="/task-routines" element={<AppLayout><TaskRoutines /></AppLayout>} />
          <Route path="/shifts" element={<AppLayout><Shifts /></AppLayout>} />
          <Route path="/schedules" element={<AppLayout><Schedules /></AppLayout>} />
          <Route path="/task-instances" element={<AppLayout><TaskInstances /></AppLayout>} />
          <Route path="/locations" element={<AppLayout><Locations /></AppLayout>} />
          <Route path="/users" element={<AppLayout><Users /></AppLayout>} />
          <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
          <Route path="/reports" element={<AppLayout><Reports /></AppLayout>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
