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
  MdNotificationsNone,
} from 'react-icons/md';

// Admin Imports
import MainDashboard from 'views/admin/default';
import NFTMarketplace from 'views/admin/marketplace';
import Profile from 'views/admin/profile';
import StatistikDistrikt from 'views/admin/statistik';
import RTL from 'views/admin/rtl';
import Tournaments from 'views/admin/Tournaments';
import TournamentDetails from 'views/admin/TournamentDetails';
import Seasons from 'views/admin/Seasons';
import MatchDetails from 'views/admin/MatchDetails';
import Chat from "components/Chat";
import NotificationsAdmin from 'views/admin/notifications/NotificationsAdmin';

import SignInCentered from 'views/auth/signIn';

const routes = [
  {
    name: 'HUB',
    layout: '/admin',
    path: '/default',
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
  {
    name: 'Till Omer',
    layout: '/rtl',
    path: '/rtl-default',
    icon: <Icon as={MdHome} width="20px" height="20px" color="inherit" />,
    component: <RTL />,
    hidden: true,
  },
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
  {
    name: 'Säsonger - Profixio',
    layout: '/admin',
    path: '/seasons',
    icon: <Icon as={MdTimeline} width="20px" height="20px" color="inherit" />,
    component: <Seasons />,
  },
  {
    name: 'Notiser',
    layout: '/admin',
    path: '/notifications',
    icon: <Icon as={MdNotificationsNone} width="20px" height="20px" color="inherit" />,
    component: <NotificationsAdmin />,
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
    component: Chat,
    hidden: true,
  },
];

export default routes;