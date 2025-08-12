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

async function fetchAllPages(factory) {
  let page = 1;
  let out = [];
  while (true) {
    const res = await factory(page);
    const chunk = Array.isArray(res)
      ? res
      : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.data) ? res.data.data : []));
    out = out.concat(chunk || []);
    const meta = res?.meta;
    if (!meta || meta.last_page == null || page >= meta.last_page) break;
    page += 1;
  }
  return out;
}

export const useProfixioUserInfo = () => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const info = await getUserInfo(user.idToken);
        if (!cancelled) setData(info);
      } catch {
        if (!cancelled) setData({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (user.idToken) run();
    return () => { cancelled = true; };
  }, [user.idToken]);

  return { data, loading };
};

export const useProfixioTournaments = (orgId, params = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const paramsKey = useMemo(() => JSON.stringify(params ?? {}), [params]);
  const stableParams = useMemo(() => {
    try { return JSON.parse(paramsKey); } catch { return {}; }
  }, [paramsKey]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const res = await getTournamentsForOrg(orgId, stableParams, user.idToken);
        const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
        if (!cancelled) setData(list || []);
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (user.idToken && orgId) run();
    return () => { cancelled = true; };
  }, [orgId, paramsKey, stableParams, user.idToken]);

  return { data, loading };
};

export const useProfixioSports = (params = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const paramsKey = useMemo(() => JSON.stringify(params ?? {}), [params]);
  const stableParams = useMemo(() => {
    try { return JSON.parse(paramsKey); } catch { return {}; }
  }, [paramsKey]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const res = await getSports(stableParams, user.idToken);
        const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
        if (!cancelled) setData(list || []);
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (user.idToken) run();
    return () => { cancelled = true; };
  }, [paramsKey, stableParams, user.idToken]);

  return { data, loading };
};

export const useProfixioSeasons = (orgId) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const sportId = 'BB';

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const res = await getSeasons(orgId, sportId, user.idToken);
        const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
        if (!cancelled) setData(list || []);
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (user.idToken && orgId) run();
    return () => { cancelled = true; };
  }, [orgId, user.idToken]);

  return { data, loading };
};

export const useProfixioSeasonTournaments = (seasonId, params = { sportId: 'BB', categoryId: '499' }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const paramsKey = useMemo(() => JSON.stringify(params ?? {}), [params]);
  const stableParams = useMemo(() => {
    try { return JSON.parse(paramsKey); } catch { return {}; }
  }, [paramsKey]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const all = await fetchAllPages(async (page) => {
          return await getSeasonTournaments(seasonId, { ...(stableParams || {}), page, limit: 100 }, user.idToken);
        });
        if (!cancelled) setData(all);
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (user.idToken && seasonId) run();
    return () => { cancelled = true; };
  }, [seasonId, paramsKey, stableParams, user.idToken]);

  return { data, loading };
};

export const useProfixioSeasonTree = (seasonId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const tree = await getSeasonTree(seasonId, user.idToken);
        if (!cancelled) setData(tree || null);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (user.idToken && seasonId) run();
    return () => { cancelled = true; };
  }, [seasonId, user.idToken]);

  return { data, loading };
};

export const useProfixioTournamentMatches = (tournamentId, params = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const paramsKey = useMemo(() => JSON.stringify(params ?? {}), [params]);
  const stableParams = useMemo(() => {
    try { return JSON.parse(paramsKey); } catch { return {}; }
  }, [paramsKey]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const all = await fetchAllPages(async (page) => {
          return await getTournamentMatches(tournamentId, { ...(stableParams || {}), page, limit: 100 }, user.idToken);
        });
        if (!cancelled) setData(Array.isArray(all) ? all : []);
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (user.idToken && tournamentId) run();
    return () => { cancelled = true; };
  }, [tournamentId, paramsKey, stableParams, user.idToken]);

  return { data, loading };
};

export const useProfixioTournamentTeams = (tournamentId, params = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const paramsKey = useMemo(() => JSON.stringify(params ?? {}), [params]);
  const stableParams = useMemo(() => {
    try { return JSON.parse(paramsKey); } catch { return {}; }
  }, [paramsKey]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const res = await getTournamentTeams(tournamentId, stableParams, user.idToken);
        const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
        if (!cancelled) setData(list || []);
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (user.idToken && tournamentId) run();
    return () => { cancelled = true; };
  }, [tournamentId, paramsKey, stableParams, user.idToken]);

  return { data, loading };
};