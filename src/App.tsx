import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import Home from './pages/Home';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import VerifyEmailSent from './pages/VerifyEmailSent';
import About from './pages/About';
import Careers from './pages/Careers';
import Changelog from './pages/Changelog';
import Inbox from './pages/Inbox';
import Compose from './pages/Compose';
import Broadcast from './pages/Broadcast';
import Dashboard from './pages/Dashboard';
import Templates from './pages/Templates';
import Chatbots from './pages/Chatbots';
import Channels from './pages/Channels';
import CRM from './pages/CRM';
import Contacts from './pages/Contacts';
import Superadmin from './pages/Superadmin';
import Team from './pages/Team';
import Settings from './pages/Settings';
import SwitchAccount from './pages/SwitchAccount';
import FeatureRequest from './pages/FeatureRequest';
import ReportIssue from './pages/ReportIssue';
import WebChatWidget from './pages/WebChatWidget';
import Integrations from './pages/Integrations';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import NotFound from './pages/NotFound';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/verify-email-sent" element={<VerifyEmailSent />} />
            <Route path="/signin" element={<Navigate to="/login" replace />} />
            <Route path="/signup" element={<Navigate to="/register" replace />} />
            <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
            <Route path="/about" element={<About />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/changelog" element={<Changelog />} />
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="inbox" element={<Inbox />} />
              <Route path="compose" element={<Compose />} />
              <Route path="broadcast" element={<Broadcast />} />
              <Route path="templates" element={<Templates />} />
              <Route path="chatbots" element={<Chatbots />} />
              <Route path="crm" element={<CRM />} />
              <Route path="contacts" element={<Contacts />} />
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" />
      </AppProvider>
    </ThemeProvider>
  );
}
