import React from 'react';

import { Icon } from '@chakra-ui/react';
import {
  MdBarChart,
  MdPerson,
  MdHome,
  MdLock,
  MdDirectionsRun,
  MdSportsBasketball,
  MdTimeline
} from 'react-icons/md';

// Admin Imports
import MainDashboard from 'views/admin/default';
import NFTMarketplace from 'views/admin/marketplace';
import Profile from 'views/admin/profile';
import DataTables from 'views/admin/dataTables';
import RTL from 'views/admin/rtl';
import Tournaments from 'views/admin/Tournaments';
import TournamentDetails from 'views/admin/TournamentDetails';
import Seasons from 'views/admin/Seasons';

// Auth Imports
import SignInCentered from 'views/auth/signIn';

const routes = [
  {
    name: 'Startsida',
    layout: '/admin',
    path: '/default',
    icon: <Icon as={MdHome} width="20px" height="20px" color="inherit" />,
    component: <MainDashboard />,
  },
  {
    name: 'Distrikt',
    layout: '/admin',
    path: '/distrikt',
    icon: <Icon as={MdDirectionsRun} width="20px" height="20px" color="inherit" />,
    component: <NFTMarketplace />,
    secondary: true,
  },
  {
    name: 'Data Tables',
    layout: '/admin',
    icon: <Icon as={MdBarChart} width="20px" height="20px" color="inherit" />,
    path: '/data-tables',
    component: <DataTables />,
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
  },
  {
    name: 'Tournament Details',
    layout: '/admin',
    path: '/tournaments/:tournamentId',
    component: <TournamentDetails />,
    hidden: true,
  },
  {
    name: 'Säsonger',
    layout: '/admin',
    path: '/seasons',
    icon: <Icon as={MdTimeline} width="20px" height="20px" color="inherit" />,
    component: <Seasons />,
  },
];

export default routes;