// src/api/statsApi.js
import axios from "axios";
import { API_BASE } from "../config/apiBase";

import { pca, loginRequest } from '../authConfig';

const STATS = `${API_BASE}/stats`;
const http = axios.create({ timeout: 15000 });

async function ensureAccessToken() {
  try {
    const result = await pca.acquireTokenSilent(loginRequest);
    return result?.accessToken;
  } catch (e) {
    return undefined;
  }
}

http.interceptors.request.use(async (config) => {
  if (!config?.headers?.Authorization) {
    const token = await ensureAccessToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

const auth = (token) => (token ? { headers: { Authorization: `Bearer ${token}` } } : {});
const withParams = (params = {}, token) => ({ params, ...auth(token) });

export const getTopScorersFromTournament = async (tournamentId, limit = 20, maxMatches = 2, token) => {
  const res = await http.get(`${STATS}/top-scorers-from-tournament`,
    withParams({ tournamentId, limit, maxMatches }, token)
  );
  return res.data;
};