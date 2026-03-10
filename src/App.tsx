import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import Home from './pages/Home';
import Inbox from './pages/Inbox';
import Compose from './pages/Compose';
import Broadcast from './pages/Broadcast';
import Templates from './pages/Templates';
import Chatbots from './pages/Chatbots';
import Channels from './pages/Channels';
import CRM from './pages/CRM';
import Superadmin from './pages/Superadmin';
import Team from './pages/Team';
import Settings from './pages/Settings';
import SwitchAccount from './pages/SwitchAccount';
import FeatureRequest from './pages/FeatureRequest';
import ReportIssue from './pages/ReportIssue';
import WebChatWidget from './pages/WebChatWidget';
import Integrations from './pages/Integrations';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Navigate to="/app/inbox" replace />} />
              <Route path="inbox" element={<Inbox />} />
              <Route path="compose" element={<Compose />} />
              <Route path="broadcast" element={<Broadcast />} />
              <Route path="templates" element={<Templates />} />
              <Route path="chatbots" element={<Chatbots />} />
              <Route path="crm" element={<CRM />} />
              <Route path="superadmin" element={<Superadmin />} />
              <Route path="channels" element={<Channels />} />
              <Route path="team" element={<Team />} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="switch-account" element={<SwitchAccount />} />
              <Route path="feature-request" element={<FeatureRequest />} />
              <Route path="report-issue" element={<ReportIssue />} />
              <Route path="web-chat-widget" element={<WebChatWidget />} />
              <Route path="settings/*" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" />
      </AppProvider>
    </ThemeProvider>
  );
}
