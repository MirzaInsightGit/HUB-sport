import './assets/css/App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from './layouts/auth';
import AdminLayout from './layouts/admin';
import RTLLogin from './layouts/rtl';
import { ChakraProvider } from '@chakra-ui/react';
import initialTheme from './theme/theme';
import { useState } from 'react';
import { MsalProvider, useIsAuthenticated } from '@azure/msal-react';

const PrivateRoute = ({ children }) => {
  const isAuthenticated = useIsAuthenticated();
  return isAuthenticated ? children : <Navigate to="/auth/sign-in" replace />;
};

export default function App({ msalInstance }) {
  const [currentTheme, setCurrentTheme] = useState(initialTheme);

  return (
    <MsalProvider instance={msalInstance}>
      <ChakraProvider theme={currentTheme}>
        <Routes>
          <Route path="auth/*" element={<AuthLayout />} />
          <Route
            path="admin/*"
            element={
              <PrivateRoute>
                <AdminLayout theme={currentTheme} setTheme={setCurrentTheme} />
              </PrivateRoute>
            }
          />
          <Route
            path="rtl/*"
            element={
              <PrivateRoute>
                <RTLLogin theme={currentTheme} setTheme={setCurrentTheme} />
              </PrivateRoute>
            }
          />
          <Route path="/" element={<Navigate to="/admin/default" replace />} />
        </Routes>
      </ChakraProvider>
    </MsalProvider>
  );
}