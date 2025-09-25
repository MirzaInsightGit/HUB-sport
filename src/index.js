import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './assets/css/App.css';
import App from './App';

import axios from 'axios';
import { pca, loginRequest } from './authConfig';
import { EventType } from '@azure/msal-browser';

// Keep active account in sync so silent token always knows which account to use
pca.addEventCallback((event) => {
  try {
    if (event?.eventType === EventType.LOGIN_SUCCESS && event?.payload?.account) {
      pca.setActiveAccount(event.payload.account);
    }
    if (!pca.getActiveAccount()) {
      const accs = pca.getAllAccounts();
      if (accs.length) pca.setActiveAccount(accs[0]);
    }
  } catch {}
});

const getAccount = () => pca.getActiveAccount() || pca.getAllAccounts()[0] || null;

// Ensure MSAL has an active account (needed for silent token)
const allAccounts = pca.getAllAccounts();
if (allAccounts.length && !pca.getActiveAccount()) {
  pca.setActiveAccount(allAccounts[0]);
}

// Attach API/Graph tokens to requests automatically
const API_BASE = process.env.REACT_APP_API_BASE;
axios.interceptors.request.use(async (config) => {
  try {
    const url = config?.url || '';
    const hasAuth = !!(config.headers && config.headers.Authorization);
    const isGraph = url.includes('graph.microsoft.com');
    const isApiCall = !isGraph && (url.startsWith('/api') || (API_BASE && url.startsWith(API_BASE)));

    if (isGraph) {
      // ALWAYS use a Graph token for Graph requests (overwrite any existing Authorization)
      const graphScopes = { scopes: ['User.Read'] };
      let graphResult = null;
      try {
        graphResult = await pca.acquireTokenSilent({ ...graphScopes, account: getAccount() });
      } catch (err) {
        try { graphResult = await pca.acquireTokenPopup({ ...graphScopes, account: getAccount() }); } catch {}
      }
      if (graphResult?.accessToken) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${graphResult.accessToken}`;
      }
    } else if (isApiCall && !hasAuth) {
      let apiResult = null;
      try {
        apiResult = await pca.acquireTokenSilent({ ...loginRequest, account: getAccount() });
      } catch (err) {
        try { apiResult = await pca.acquireTokenPopup({ ...loginRequest, account: getAccount() }); } catch {}
      }
      if (apiResult?.accessToken) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${apiResult.accessToken}`;
      }
    }
  } catch (e) {
    // låt request gå vidare även om silent token faller
  }
  return config;
});


// Also patch global fetch so legacy fetch-calls get proper tokens (Graph/API)
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  const originalFetch = window.fetch.bind(window);
  const API_BASE_FOR_FETCH = process.env.REACT_APP_API_BASE;

  window.fetch = async (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      const isGraph = url.includes('graph.microsoft.com');
      const isApiCall = !isGraph && (url.startsWith('/api') || (API_BASE_FOR_FETCH && url.startsWith(API_BASE_FOR_FETCH)));

      const headers = new Headers(init.headers || {});
      const hasAuth = headers.has('Authorization');

      if (isGraph) {
        const graphScopes = { scopes: ['User.Read'] };
        let graphResult = null;
        try {
          graphResult = await pca.acquireTokenSilent({ ...graphScopes, account: getAccount() });
        } catch (err) {
          try { graphResult = await pca.acquireTokenPopup({ ...graphScopes, account: getAccount() }); } catch {}
        }
        if (graphResult?.accessToken) {
          headers.set('Authorization', `Bearer ${graphResult.accessToken}`);
        }
      } else if (isApiCall && !hasAuth) {
        let apiResult = null;
        try {
          apiResult = await pca.acquireTokenSilent({ ...loginRequest, account: getAccount() });
        } catch (err) {
          try { apiResult = await pca.acquireTokenPopup({ ...loginRequest, account: getAccount() }); } catch {}
        }
        if (apiResult?.accessToken) {
          headers.set('Authorization', `Bearer ${apiResult.accessToken}`);
        }
      }

      init.headers = headers;
    } catch (e) {
      // fall through without token if silent acquisition fails
    }
    return originalFetch(input, init);
  };
}

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <BrowserRouter>
    <App msalInstance={pca} />
  </BrowserRouter>,
);