import React from 'react';

import { Icon } from '@chakra-ui/react';
import {
  MdPerson,
  MdHome,
  MdLock,
  MdDirectionsRun,
  MdSportsBasketball,
  MdTimeline,
  MdChat,
  MdQueryStats, 
  MdCalendarMonth,
  MdSettings,
  MdNotificationsNone,
  MdAttachMoney,
} from 'react-icons/md';

// Admin Imports
import MainDashboard from 'views/admin/hub';
import NFTMarketplace from 'views/admin/marketplace';
import Profile from 'views/admin/profile';
import StatistikDistrikt from 'views/admin/statistik';
import Settings from "views/admin/settings/Settings";
import Tournaments from 'views/admin/Tournaments';
import TournamentDetails from 'views/admin/TournamentDetails';
import Seasons from 'views/admin/Seasons';
import MatchDetails from 'views/admin/MatchDetails';
import Chat from "components/Chat";
import NotificationsAdmin from 'views/admin/notifications/NotificationsAdmin';
import SearchResults from "views/admin/search/SearchResults";
import SignInCentered from 'views/auth/signIn';
import RoleGuard from 'components/auth/RoleGuard';
import Economy from 'views/admin/Economy';

// -------------------------------------------------------------
// Route policy
// - No role specified  => accessible to all authenticated roles
// - allow: ['admin']   => only admins may access (enforced by RoleGuard)
// - allow: ['admin','coach'] => admins and coaches
// Also: sidebar/renderers can hide items based on `allow`/`hidden`.
// -------------------------------------------------------------

const routes = [
  // HUB dashboard (visible for all authenticated roles)
  {
    name: 'HUB',
    layout: '/admin',
    path: '/hub',
    icon: <Icon as={MdHome} width="20px" height="20px" color="inherit" />,
    component: <MainDashboard />,
  },
  {
    name: 'Anmälan + Distrikt',
    layout: '/admin',
    path: '/distrikt',
    icon: <Icon as={MdDirectionsRun} width="20px" height="20px" color="inherit" />,
    component: <NFTMarketplace />,
    secondary: true,
  },
  // visible to all roles
  {
    name: 'Statistik - Distrikt',
    layout: '/admin',
    path: '/statistik-distrikt',
    icon: <Icon as={MdTimeline} width="20px" height="20px" color="inherit" />,
    component: <StatistikDistrikt />,
  },
  {
    name: 'Profile',
    layout: '/admin',
    path: '/profile',
    icon: <Icon as={MdPerson} width="20px" height="20px" color="inherit" />,
    component: <Profile />,
    hidden: true,
  },
  {
    name: 'Sign In',
    layout: '/auth',
    path: '/sign-in',
    icon: <Icon as={MdLock} width="20px" height="20px" color="inherit" />,
    component: <SignInCentered />,
    hidden: true,
  },
  // visible to all roles
  {
    name: 'Turneringar',
    layout: '/admin',
    path: '/tournaments',
    icon: <Icon as={MdSportsBasketball} width="20px" height="20px" color="inherit" />,
    component: <Tournaments />,
    hidden: true,
  },
  {
    name: 'Tournament Details',
    layout: '/admin',
    path: '/tournaments/:tournamentId',
    component: <TournamentDetails />,
    hidden: true,
  },
  // visible to all roles
  {
    name: 'Säsonger - Profixio',
    layout: '/admin',
    path: '/seasons',
    icon: <Icon as={MdCalendarMonth} width="20px" height="20px" color="inherit" />,
    component: <Seasons />,
  },
  // admin-only
  {
    name: 'Notiser',
    layout: '/admin',
    path: '/notifications',
    icon: <Icon as={MdNotificationsNone} width="20px" height="20px" color="inherit" />,
    component: (
      <RoleGuard allow={['admin']}>
        <NotificationsAdmin />
      </RoleGuard>
    ),
    allow: ['admin'], // ⬅️ Endast admin ska se/komma in
    hidden: true,
  },
  {
    name: 'Match Details',
    layout: '/admin',
    path: '/matches/:tournamentId/:matchId',
    component: <MatchDetails />,
    hidden: true,
  },
  {
    name: "Chat - Internal",
    layout: "/admin",
    path: "/chat",
    icon: <Icon as={MdChat} width="20px" height="20px" color="inherit" />,
    component: (
      <RoleGuard allow={['admin']}>
        <Chat />
      </RoleGuard>
    ),
    allow: ['admin'],
    hidden: true,
  },
  {
    name: 'Sök',
    layout: '/admin',
    path: '/search',
    component: (
      <RoleGuard allow={['admin','coach']}>
        <SearchResults />
      </RoleGuard>
    ),
    hidden: true,
    allow: ['admin','coach']
  },
  // admin-only
  {
    name: "Ekonomi",
    layout: "/admin",
    path: "/economy",
    icon: <Icon as={MdAttachMoney} width="20px" height="20px" color="inherit" />,
    component: (
      <RoleGuard allow={['admin']}>
        <Economy />
      </RoleGuard>
    ),
    allow: ['admin'],
    hidden: true,
  },
  {
    name: "Settings",
    layout: "/admin",
    path: "/settings",
    icon: <MdSettings />,
    component: (
      <RoleGuard allow={['admin']}>
        <Settings />
      </RoleGuard>
    ),
    allow: ['admin'],
    hidden: true,
  }
];

export default routes;