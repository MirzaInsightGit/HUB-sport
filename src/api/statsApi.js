// src/api/statsApi.js
import axios from "axios";
import { API_BASE } from "../config/apiBase";

const STATS = `${API_BASE}/stats`;
const http = axios.create({ timeout: 15000 });

const auth = (token) => (token ? { headers: { Authorization: `Bearer ${token}` } } : {});
const withParams = (params = {}, token) => ({ params, ...auth(token) });

export const getTopScorersFromTournament = async (tournamentId, limit = 20, maxMatches = 2, token) => {
  const res = await http.get(`${STATS}/top-scorers-from-tournament`,
    withParams({ tournamentId, limit, maxMatches }, token)
  );
  return res.data;
};