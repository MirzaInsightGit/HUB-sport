import { PublicClientApplication } from '@azure/msal-browser';

export const msalConfig = {
  auth: {
    clientId: '43fc08d4-078b-43f4-b028-34f651f0e933',
    authority: 'https://login.microsoftonline.com/564c8f24-8b84-4c5a-aab1-98a797f5eb30/v2.0',
    redirectUri: window.location.origin + '/auth/sign-in',
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

// Request token for our backend API (Portal-STHLM-API)
export const loginRequest = {
  scopes: ['api://07f2d268-491d-47fb-9600-ba69d3ab5ce2/access.read'],
};

export const pca = new PublicClientApplication(msalConfig);