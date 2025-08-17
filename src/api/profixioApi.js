// src/api/profixioApi.js
import axios from 'axios';
import { API_BASE } from '../config/apiBase';

// Build backend base from env-aware API_BASE (local/prod)
const BACKEND_URL = `${API_BASE}/profixio`;

// Helper: headers only when a token is provided (backend may bypass locally)
const auth = (token) => (token ? { headers: { Authorization: `Bearer ${token}` } } : {});

// Helper: merge params + optional auth
const withParams = (params = {}, token) => ({ params, ...auth(token) });

// Optional: common axios config (timeouts etc.)
const http = axios.create({ timeout: 15000 });

export const getUserInfo = async (token) => {
  const res = await http.get(`${BACKEND_URL}/userinfo`, auth(token));
  return res.data;
};

export const getSports = async (params = {}, token) => {
  const res = await http.get(`${BACKEND_URL}/sports`, withParams(params, token));
  return res.data;
};

export const getMatchSetup = async (kamp, token) => {
  const res = await http.get(`${BACKEND_URL}/matches/${kamp}/setup`, auth(token));
  return res.data;
};

export const getMatchEventTypes = async (organisation_id, params = {}, token) => {
  const res = await http.get(
    `${BACKEND_URL}/organisations/${organisation_id}/matchEventTypes`,
    withParams(params, token)
  );
  return res.data;
};

export const getMatchLineup = async (tournament_id, match_id, token) => {
  const res = await http.get(
    `${BACKEND_URL}/tournaments/${tournament_id}/matches/${match_id}/lineup`,
    auth(token)
  );
  return res.data;
};

export const getMatchEvents = async (tournament_id, match_id, token) => {
  const res = await http.get(
    `${BACKEND_URL}/tournaments/${tournament_id}/matches/${match_id}/events`,
    auth(token)
  );
  return res.data;
};

export const getMatchStats = async (tournament_id, match_id, token) => {
  const res = await http.get(
    `${BACKEND_URL}/tournaments/${tournament_id}/matches/${match_id}/stats`,
    auth(token)
  );
  return res.data;
};

export const getSeasonMatches = async (season_id, token) => {
  const res = await http.get(`${BACKEND_URL}/seasons/${season_id}/matches`, auth(token));
  return res.data;
};

export const getSeasonDeletedMatches = async (season_id, token) => {
  const res = await http.get(`${BACKEND_URL}/seasons/${season_id}/deletedMatches`, auth(token));
  return res.data;
};

export const getTournamentTables = async (tournament_id, token) => {
  const res = await http.get(`${BACKEND_URL}/tournaments/${tournament_id}/tables`, auth(token));
  return res.data;
};

// NOTE: supports pagination with params (e.g., { page, limit })
export const getTournamentMatches = async (tournament_id, params = {}, token) => {
  const res = await http.get(
    `${BACKEND_URL}/tournaments/${tournament_id}/matches`,
    withParams(params, token)
  );
  return res.data;
};

export const getMatch = async (tournament_id, match_id, token) => {
  const res = await http.get(
    `${BACKEND_URL}/tournaments/${tournament_id}/matches/${match_id}`,
    auth(token)
  );
  return res.data;
};

// ✅ Nytt: alias som din sida importerar
export const getMatchDetails = async (tournament_id, match_id, token) => {
  const res = await http.get(
    `${BACKEND_URL}/tournaments/${tournament_id}/matches/${match_id}`,
    auth(token)
  );
  return res.data;
};

export const postMatchGameUrl = async (tournament_id, match_id, data, token) => {
  const res = await http.post(
    `${BACKEND_URL}/tournaments/${tournament_id}/matches/${match_id}/game_url`,
    data,
    auth(token)
  );
  return res.data;
};

export const putMatch = async (tournament_id, match_id, data, token) => {
  const res = await http.put(
    `${BACKEND_URL}/tournaments/${tournament_id}/matches/${match_id}`,
    data,
    auth(token)
  );
  return res.data;
};

export const getOrganisation = async (id, token) => {
  const res = await http.get(`${BACKEND_URL}/organisations/${id}`, auth(token));
  return res.data;
};

export const getOrganisationCategories = async (organisation_id, token) => {
  const res = await http.get(
    `${BACKEND_URL}/organisations/${organisation_id}/categories`,
    auth(token)
  );
  return res.data;
};

export const getOrganisationClubs = async (organisation_id, token) => {
  const res = await http.get(`${BACKEND_URL}/organisations/${organisation_id}/clubs`, auth(token));
  return res.data;
};

export const getOrganisationAllPlayers = async (organisation_id, params = {}, token) => {
  const res = await http.get(
    `${BACKEND_URL}/organisations/${organisation_id}/allPlayers`,
    withParams(params, token)
  );
  return res.data;
};

export const getOrganisationDistricts = async (organisation_id, token) => {
  const res = await http.get(
    `${BACKEND_URL}/organisations/${organisation_id}/districts`,
    auth(token)
  );
  return res.data;
};

export const getOrganisationDistrict = async (organisation_id, id, token) => {
  const res = await http.get(
    `${BACKEND_URL}/organisations/${organisation_id}/districts/${id}`,
    auth(token)
  );
  return res.data;
};

export const getOrganisationInvoices = async (organisation_id, token) => {
  const res = await http.get(
    `${BACKEND_URL}/organisations/${organisation_id}/invoices`,
    auth(token)
  );
  return res.data;
};

export const getOrganisationInvoice = async (organisation_id, number, token) => {
  const res = await http.get(
    `${BACKEND_URL}/organisations/${organisation_id}/invoices/${number}`,
    auth(token)
  );
  return res.data;
};

export const postOrganisationInvoicesBulkUpdate = async (organisation_id, data, token) => {
  const res = await http.post(
    `${BACKEND_URL}/organisations/${organisation_id}/invoices/bulkUpdate`,
    data,
    auth(token)
  );
  return res.data;
};

export const getTournamentRankingPoints = async (tournament_id, token) => {
  const res = await http.get(`${BACKEND_URL}/tournaments/${tournament_id}/rankingpoints`, auth(token));
  return res.data;
};

export const getTournament = async (id, token) => {
  const res = await http.get(`${BACKEND_URL}/tournaments/${id}`, auth(token));
  return res.data;
};

export const getTournamentTeams = async (tournament_id, params = {}, token) => {
  const res = await http.get(
    `${BACKEND_URL}/tournaments/${tournament_id}/teams`,
    withParams(params, token)
  );
  return res.data;
};

export const getTournamentGlobalTeams = async (tournament_id, params = {}, token) => {
  const res = await http.get(
    `${BACKEND_URL}/tournaments/${tournament_id}/globalTeams`,
    withParams(params, token)
  );
  return res.data;
};

export const getTournamentClubs = async (tournament_id, params = {}, token) => {
  const res = await http.get(
    `${BACKEND_URL}/tournaments/${tournament_id}/clubs`,
    withParams(params, token)
  );
  return res.data;
};

export const getTournamentMatchCategories = async (tournament_id, token) => {
  const res = await http.get(
    `${BACKEND_URL}/tournaments/${tournament_id}/matchCategories`,
    auth(token)
  );
  return res.data;
};

export const getTournamentMatchGroups = async (tournament_id, token) => {
  const res = await http.get(
    `${BACKEND_URL}/tournaments/${tournament_id}/matchGroups`,
    auth(token)
  );
  return res.data;
};

export const getTournamentArenas = async (tournament_id, token) => {
  const res = await http.get(`${BACKEND_URL}/tournaments/${tournament_id}/arenas`, auth(token));
  return res.data;
};

export const getTournamentsForOrg = async (orgId, params = {}, token) => {
  const res = await http.get(
    `${BACKEND_URL}/organisations/${orgId}/tournaments`,
    withParams(params, token)
  );
  return res.data;
};

export const getSeasons = async (orgId, sportId, token) => {
  const p = { sportId: sportId || 'BB' };
  const res = await http.get(`${BACKEND_URL}/organisations/${orgId}/seasons`, withParams(p, token));
  return res.data;
};

export const getSeasonTournaments = async (season_id, params = {}, token) => {
  const p = { sportId: 'BB', ...params };
  const res = await http.get(`${BACKEND_URL}/seasons/${season_id}/tournaments`, withParams(p, token));
  return res.data;
};

// --- NEW: season tree (ersätter leagues) ---
export const getSeasonTree = async (season_id, token) => {
  const res = await http.get(`${BACKEND_URL}/seasons/${season_id}/tree`, auth(token));
  return res.data;
};