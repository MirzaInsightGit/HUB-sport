// src/hooks/useProfixio.js
import { useState, useEffect, useMemo } from 'react';
import useAuth from './useAuth';
import {
  getTournamentsForOrg,
  getUserInfo,
  getSports,
  getTournamentMatches,
  getTournamentTeams,
  getSeasons,
  getSeasonTournaments,
  getSeasonTree,
} from '../api/profixioApi';

// Generic helper to fetch all pages when API supports meta.last_page.
// If the API does not paginate (no meta), we avoid infinite loops and just return the first page.
async function fetchAllPages(factory) {
  let page = 1;
  let aggregated = [];
  while (true) {
    const res = await factory(page);
    const dataPart = Array.isArray(res)
      ? res
      : (Array.isArray(res?.data) ? res.data : (res?.data?.data || []));
    const meta = res?.meta;

    // Append this page's items
    aggregated = aggregated.concat(dataPart || []);

    // If there's no meta/last_page, or we reached the end, stop.
    if (!meta || meta.last_page == null || page >= meta.last_page) {
      break;
    }
    page += 1;
  }
  return aggregated;
}

export const useProfixioTournaments = (orgId, params = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const tournamentsParamsKey = useMemo(() => JSON.stringify(params ?? {}), [params]);
  const tournamentsStableParams = useMemo(() => {
    try { return JSON.parse(tournamentsParamsKey); } catch (e) { return {}; }
  }, [tournamentsParamsKey]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tournaments = await getTournamentsForOrg(orgId, tournamentsStableParams, user.idToken);
        setData(tournaments.data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (user.idToken) fetchData();
  }, [orgId, tournamentsParamsKey, tournamentsStableParams, user.idToken]);

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
  const sportsParamsKey = useMemo(() => JSON.stringify(params ?? {}), [params]);
  const sportsStableParams = useMemo(() => {
    try { return JSON.parse(sportsParamsKey); } catch (e) { return {}; }
  }, [sportsParamsKey]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sports = await getSports(sportsStableParams, user.idToken);
        setData(sports.data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (user.idToken) fetchData();
  }, [sportsParamsKey, sportsStableParams, user.idToken]);

  return { data, loading };
};

// NOTE: stöder params (t.ex. { page, limit })
export const useProfixioTournamentMatches = (tournamentId, params = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const matchesParamsKey = useMemo(() => JSON.stringify(params ?? {}), [params]);
  const matchesStableParams = useMemo(() => {
    try { return JSON.parse(matchesParamsKey); } catch (e) { return {}; }
  }, [matchesParamsKey]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const matches = await getTournamentMatches(tournamentId, matchesStableParams, user.idToken);
        if (Array.isArray(matches)) {
          setData(matches);
        } else if (matches?.data && Array.isArray(matches.data)) {
          setData(matches.data);
        } else {
          setData([]);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (user.idToken && tournamentId) fetchData();
  }, [tournamentId, matchesParamsKey, matchesStableParams, user.idToken]);

  return { data, loading };
};

export const useProfixioTournamentTeams = (tournamentId, params = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const teamsParamsKey = useMemo(() => JSON.stringify(params ?? {}), [params]);
  const teamsStableParams = useMemo(() => {
    try { return JSON.parse(teamsParamsKey); } catch (e) { return {}; }
  }, [teamsParamsKey]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const teams = await getTournamentTeams(tournamentId, teamsStableParams, user.idToken);
        setData(Array.isArray(teams) ? teams : teams?.data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (user.idToken && tournamentId) fetchData();
  }, [tournamentId, teamsParamsKey, teamsStableParams, user.idToken]);

  return { data, loading };
};

export const useProfixioSeasons = (orgId) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const sportId = 'BB';

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getSeasons(orgId, sportId, user.idToken);
        const list = Array.isArray(res)
          ? res
          : (Array.isArray(res?.data) ? res.data : []);
        if (!cancelled) setData(list || []);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError(e);
          setData([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (user.idToken && orgId) run();
    return () => { cancelled = true; };
  }, [orgId, user.idToken]);

  return { data, loading, error };
};

export const useProfixioSeasonTournaments = (seasonId, params = { sportId: 'BB', categoryId: '499' }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const seasonTournamentsParamsKey = useMemo(() => JSON.stringify(params ?? {}), [params]);
  const seasonTournamentsStableParams = useMemo(() => {
    try { return JSON.parse(seasonTournamentsParamsKey); } catch (e) { return {}; }
  }, [seasonTournamentsParamsKey]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const all = await fetchAllPages(async (page) => {
          const res = await getSeasonTournaments(
            seasonId,
            { ...(seasonTournamentsStableParams || {}), page, limit: 100 },
            user.idToken
          );
          return res;
        });
        if (!cancelled) setData(all);
      } catch (error) {
        console.error(error);
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (user.idToken && seasonId) run();
    return () => { cancelled = true; };
  }, [seasonId, seasonTournamentsParamsKey, seasonTournamentsStableParams, user.idToken]);

  return { data, loading };
};

// --- NEW: Season Tree hook ---
export const useProfixioSeasonTree = (seasonId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const tree = await getSeasonTree(seasonId, user.idToken);
        setData(tree || null);
      } catch (err) {
        console.error(err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    if (user.idToken && seasonId) fetchData();
  }, [seasonId, user.idToken]);

  return { data, loading, error };
};