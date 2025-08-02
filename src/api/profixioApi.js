// src/api/profixioApi.js
import axios from 'axios';

const BACKEND_URL = 'https://stockholmbasket-express-api-avf6ayfkdnc3b6gn.centralus-01.azurewebsites.net/api/profixio';

export const getUserInfo = async (token) => {
  const res = await axios.get(`${BACKEND_URL}/userinfo`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getSports = async (params = {}, token) => {
  const res = await axios.get(`${BACKEND_URL}/sports`, {
    params,
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getMatchSetup = async (kamp, token) => {
  const res = await axios.get(`${BACKEND_URL}/matches/${kamp}/setup`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getMatchEventTypes = async (organisation_id, params = {}, token) => {
  const res = await axios.get(`${BACKEND_URL}/organisations/${organisation_id}/matchEventTypes`, {
    params,
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getMatchLineup = async (tournament_id, match_id, token) => {
  const res = await axios.get(`${BACKEND_URL}/tournaments/${tournament_id}/matches/${match_id}/lineup`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getMatchEvents = async (tournament_id, match_id, token) => {
  const res = await axios.get(`${BACKEND_URL}/tournaments/${tournament_id}/matches/${match_id}/events`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getSeasonMatches = async (season_id, token) => {
  const res = await axios.get(`${BACKEND_URL}/seasons/${season_id}/matches`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getSeasonDeletedMatches = async (season_id, token) => {
  const res = await axios.get(`${BACKEND_URL}/seasons/${season_id}/deletedMatches`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getTournamentTables = async (tournament_id, token) => {
  const res = await axios.get(`${BACKEND_URL}/tournaments/${tournament_id}/tables`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getTournamentMatches = async (tournament_id, token) => {
  const res = await axios.get(`${BACKEND_URL}/tournaments/${tournament_id}/matches`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getMatch = async (tournament_id, match_id, token) => {
  const res = await axios.get(`${BACKEND_URL}/tournaments/${tournament_id}/matches/${match_id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const postMatchGameUrl = async (tournament_id, match_id, data, token) => {
  const res = await axios.post(`${BACKEND_URL}/tournaments/${tournament_id}/matches/${match_id}/game_url`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const putMatch = async (tournament_id, match_id, data, token) => {
  const res = await axios.put(`${BACKEND_URL}/tournaments/${tournament_id}/matches/${match_id}`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getOrganisation = async (id, token) => {
  const res = await axios.get(`${BACKEND_URL}/organisations/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getOrganisationCategories = async (organisation_id, token) => {
  const res = await axios.get(`${BACKEND_URL}/organisations/${organisation_id}/categories`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getOrganisationClubs = async (organisation_id, token) => {
  const res = await axios.get(`${BACKEND_URL}/organisations/${organisation_id}/clubs`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getOrganisationAllPlayers = async (organisation_id, params = {}, token) => {
  const res = await axios.get(`${BACKEND_URL}/organisations/${organisation_id}/allPlayers`, {
    params,
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getOrganisationDistricts = async (organisation_id, token) => {
  const res = await axios.get(`${BACKEND_URL}/organisations/${organisation_id}/districts`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getOrganisationDistrict = async (organisation_id, id, token) => {
  const res = await axios.get(`${BACKEND_URL}/organisations/${organisation_id}/districts/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getOrganisationInvoices = async (organisation_id, token) => {
  const res = await axios.get(`${BACKEND_URL}/organisations/${organisation_id}/invoices`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getOrganisationInvoice = async (organisation_id, number, token) => {
  const res = await axios.get(`${BACKEND_URL}/organisations/${organisation_id}/invoices/${number}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const postOrganisationInvoicesBulkUpdate = async (organisation_id, data, token) => {
  const res = await axios.post(`${BACKEND_URL}/organisations/${organisation_id}/invoices/bulkUpdate`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getTournamentRankingPoints = async (tournament_id, token) => {
  const res = await axios.get(`${BACKEND_URL}/tournaments/${tournament_id}/rankingpoints`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getTournament = async (id, token) => {
  const res = await axios.get(`${BACKEND_URL}/tournaments/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getTournamentTeams = async (tournament_id, params = {}, token) => {
  const res = await axios.get(`${BACKEND_URL}/tournaments/${tournament_id}/teams`, {
    params,
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getTournamentGlobalTeams = async (tournament_id, params = {}, token) => {
  const res = await axios.get(`${BACKEND_URL}/tournaments/${tournament_id}/globalTeams`, {
    params,
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getTournamentClubs = async (tournament_id, params = {}, token) => {
  const res = await axios.get(`${BACKEND_URL}/tournaments/${tournament_id}/clubs`, {
    params,
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getTournamentMatchCategories = async (tournament_id, token) => {
  const res = await axios.get(`${BACKEND_URL}/tournaments/${tournament_id}/matchCategories`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getTournamentMatchGroups = async (tournament_id, token) => {
  const res = await axios.get(`${BACKEND_URL}/tournaments/${tournament_id}/matchGroups`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getTournamentArenas = async (tournament_id, token) => {
  const res = await axios.get(`${BACKEND_URL}/tournaments/${tournament_id}/arenas`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getTournamentsForOrg = async (orgId, params = {}, token) => {
  const res = await axios.get(`${BACKEND_URL}/organisations/${orgId}/tournaments`, {
    params,
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getSeasons = async (orgId, sportId, token) => {
  const res = await axios.get(`${BACKEND_URL}/organisations/${orgId}/seasons`, {
    params: { sportId },
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

// src/api/profixioApi.js - Add function
export const getSeasonTournaments = async (season_id, params = {}, token) => {
  const res = await axios.get(`${BACKEND_URL}/seasons/${season_id}/tournaments`, {
    params,
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};