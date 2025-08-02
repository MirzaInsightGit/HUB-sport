// src/hooks/useProfixio.js
import { useState, useEffect } from 'react';
import useAuth from './useAuth';
import {
  getTournamentsForOrg,
  getUserInfo,
  getSports,
  getTournamentMatches,
  getTournamentTeams,
  getSeasons,
  getSeasonTournaments
} from '../api/profixioApi';

export const useProfixioTournaments = (orgId, params = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tournaments = await getTournamentsForOrg(orgId, params, user.idToken);
        setData(tournaments.data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (user.idToken) fetchData();
  }, [orgId, params, user.idToken]);

  return { data, loading };
};

export const useProfixioUserInfo = () => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const info = await getUserInfo(user.idToken);
        setData(info);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (user.idToken) fetchData();
  }, [user.idToken]);

  return { data, loading };
};

export const useProfixioSports = (params = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sports = await getSports(params, user.idToken);
        setData(sports.data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (user.idToken) fetchData();
  }, [params, user.idToken]);

  return { data, loading };
};

export const useProfixioTournamentMatches = (tournamentId) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const matches = await getTournamentMatches(tournamentId, user.idToken);
        setData(Array.isArray(matches) ? matches : []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (user.idToken && tournamentId) fetchData();
  }, [tournamentId, user.idToken]);

  return { data, loading };
};

export const useProfixioTournamentTeams = (tournamentId, params = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const teams = await getTournamentTeams(tournamentId, params, user.idToken);
        setData(Array.isArray(teams) ? teams : []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (user.idToken && tournamentId) fetchData();
  }, [tournamentId, params, user.idToken]);

  return { data, loading };
};

export const useProfixioSeasons = (orgId) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const sportId = 'BB';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const seasons = await getSeasons(orgId, sportId, user.idToken);
        setData(seasons.data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (user.idToken) fetchData();
  }, [orgId, user.idToken]);

  return { data, loading };
};

export const useProfixioSeasonTournaments = (seasonId) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tree = await getSeasonTournaments(seasonId, {}, user.idToken);
        setData(tree || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (user.idToken && seasonId) fetchData();
  }, [seasonId, user.idToken]);

  return { data, loading };
};

