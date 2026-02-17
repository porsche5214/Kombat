import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainMenu from "./pages/MainMenu";
import SelectMode from "./pages/SelectMode";
import HowToPlay from "./pages/HowToPlay";
import SetupPhase from "./pages/SetupPhase";
import GamePhase from "./pages/GamePhase";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainMenu />} />
          <Route path="/select-mode" element={<SelectMode />} />
          <Route path="/how-to-play" element={<HowToPlay />} />
          <Route path="/setup" element={<SetupPhase />} />
          <Route path="/shopping" element={<GamePhase />} />
          <Route path="/execution" element={<GamePhase />} />
          <Route path="/game" element={<GamePhase />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
