import './assets/css/App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from './layouts/auth';
import AdminLayout from './layouts/admin';
import RTLLogin from './layouts/rtl';
import { ChakraProvider } from '@chakra-ui/react';
import initialTheme from './theme/theme';
import { useState } from 'react';
import { MsalProvider } from '@azure/msal-react';

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
              <AdminLayout theme={currentTheme} setTheme={setCurrentTheme} />
            }
          />
          <Route
            path="rtl/*"
            element={
              <RTLLogin theme={currentTheme} setTheme={setCurrentTheme} />
            }
          />
          <Route path="/" element={<Navigate to="/admin" replace />} />
        </Routes>
      </ChakraProvider>
    </MsalProvider>
  );
}