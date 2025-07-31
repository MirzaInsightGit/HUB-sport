import './assets/css/App.css';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import AuthLayout from './layouts/auth';
import AdminLayout from './layouts/admin';
import RTLLogin from './layouts/rtl';
import { ChakraProvider } from '@chakra-ui/react';
import initialTheme from './theme/theme';
import { useState, useEffect } from 'react';
import { MsalProvider, useIsAuthenticated } from '@azure/msal-react';

export default function App({ msalInstance }) {
  const [currentTheme, setCurrentTheme] = useState(initialTheme);
  const isAuthenticated = useIsAuthenticated();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated && location.pathname.startsWith('/auth')) {
      navigate('/admin/default', { replace: true });
    } else if (!isAuthenticated && (location.pathname.startsWith('/admin') || location.pathname.startsWith('/rtl'))) {
      navigate('/auth/sign-in', { replace: true });
    }
  }, [isAuthenticated, location.pathname, navigate]);

  return (
    <MsalProvider instance={msalInstance}>
      <ChakraProvider theme={currentTheme}>
        <Routes>
          <Route path="auth/*" element={<AuthLayout />} />
          <Route
            path="admin/*"
            element={<AdminLayout theme={currentTheme} setTheme={setCurrentTheme} />}
          />
          <Route
            path="rtl/*"
            element={<RTLLogin theme={currentTheme} setTheme={setCurrentTheme} />}
          />
          <Route path="/" element={<Navigate to="/auth/sign-in" replace />} />
          <Route path="*" element={<Navigate to="/auth/sign-in" replace />} />
        </Routes>
      </ChakraProvider>
    </MsalProvider>
  );
}