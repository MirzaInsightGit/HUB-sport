import './assets/css/App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from './layouts/auth';
import AdminLayout from './layouts/admin';
import { ChakraProvider } from '@chakra-ui/react';
import initialTheme from './theme/theme';
import { useState } from 'react';
import { MsalProvider, useIsAuthenticated, useMsal } from '@azure/msal-react';
import Chat from './components/Chat'; // Importera Chat
import useAuth from 'hooks/useAuth';

const AUTH_MODE = process.env.REACT_APP_AUTH_MODE || 'default'; // default | strict_groups
const AUTH_DIAG = process.env.REACT_APP_AUTH_DIAG === 'true';

const PrivateRoute = ({ children }) => {
  const isAuthenticated = useIsAuthenticated();
  return isAuthenticated ? children : <Navigate to="/auth/sign-in" replace />;
};

const RoleGuard = ({ allow = [], children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/auth/sign-in" replace />;
  }
  if (isLoading) {
    return null; // eller en loader om du vill
  }

  const roles = user?.roles ?? [];
  const groups = user?.groups ?? [];

  const ADMIN_GROUP_IDS = (process.env.REACT_APP_ADMIN_GROUP_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const COACH_GROUP_IDS = (process.env.REACT_APP_COACH_GROUP_IDS || "f824f296-d48c-4b56-bf17-3368ecb58dfa")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const hasRole = (name) => roles.includes(String(name).toLowerCase());
  const hasGroup = (allowed) => allowed.some((id) => groups.includes(id));

  const isAllowedByRole = () => allow.map(String).map(s=>s.toLowerCase()).some(r => roles.includes(r));
  const isAllowedByGroup = () => {
    const needAdmin = allow.map(String).map(s=>s.toLowerCase()).includes('admin');
    const needCoach = allow.map(String).map(s=>s.toLowerCase()).includes('coach');
    const adminOk = needAdmin && hasGroup(ADMIN_GROUP_IDS);
    const coachOk = needCoach && hasGroup(COACH_GROUP_IDS);
    return adminOk || coachOk;
  };

  let ok = false;
  if (AUTH_MODE === 'strict_groups') {
    ok = isAllowedByGroup();
  } else {
    ok = isAllowedByRole() || isAllowedByGroup();
  }

  return ok ? children : <Navigate to="/unauthorized" replace />;
};

const LandingRedirect = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/auth/sign-in" replace />;
  }
  if (isLoading) {
    return null; // invänta claims
  }

  const roles = user?.roles ?? [];
  const groups = user?.groups ?? [];

  // En enda URL-yta: /admin/hub används som "default" för både admin och coach
  if (roles.includes('admin')) return <Navigate to="/admin/hub" replace />;
  if (roles.includes('coach') || groups.includes('f824f296-d48c-4b56-bf17-3368ecb58dfa')) return <Navigate to="/admin/hub" replace />;
  return <Navigate to="/unauthorized" replace />;
};

const DebugClaimsPublic = () => {
  const { accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const claims = accounts?.[0]?.idTokenClaims || null;
  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ marginBottom: '0.5rem' }}>Auth state: {String(isAuthenticated)}</div>
      <pre style={{ whiteSpace: 'pre-wrap' }}>
        {JSON.stringify({
          hasAccount: !!accounts?.length,
          username: accounts?.[0]?.username || null,
          idTokenClaims: claims || null,
        }, null, 2)}
      </pre>
    </div>
  );
};

const DebugClaims = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (!isAuthenticated) return <div>Inte inloggad</div>;
  if (isLoading) return <div>Laddar...</div>;
  return (
    <pre style={{ padding: '1rem', whiteSpace: 'pre-wrap' }}>
      {JSON.stringify({ email: user?.email, roles: user?.roles, groups: user?.groups }, null, 2)}
    </pre>
  );
};

export default function App({ msalInstance }) {
  const [currentTheme, setCurrentTheme] = useState(initialTheme);

  return (
    <MsalProvider instance={msalInstance}>
      <ChakraProvider theme={currentTheme}>
        <Routes>
          <Route path="auth/*" element={<AuthLayout />} />
          {AUTH_DIAG && (
            <Route path="/debug/claims" element={<DebugClaimsPublic />} />
          )}
          <Route
            path="admin/*"
            element={
              <PrivateRoute>
                <RoleGuard allow={["admin", "coach"]}>
                  <AdminLayout theme={currentTheme} setTheme={setCurrentTheme} />
                </RoleGuard>
              </PrivateRoute>
            }
          />
          
          <Route path="/" element={<LandingRedirect />} />
          <Route
            path="admin/chat"
            element={
              <PrivateRoute>
                <Chat />
              </PrivateRoute>
            }
          />
          <Route path="/unauthorized" element={<div style={{padding:'2rem', fontSize:'18px'}}>Ingen behörighet. Kontakta administratören om du behöver åtkomst.</div>} />
        </Routes>
      </ChakraProvider>
    </MsalProvider>
  );
}