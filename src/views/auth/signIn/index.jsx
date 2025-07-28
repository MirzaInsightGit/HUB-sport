import React from 'react';
     import { Box, Flex, Text, Button, Image } from '@chakra-ui/react';
     import { useMsal } from '@azure/msal-react';
     import { msalConfig, loginRequest } from '../../../authConfig';

     const Login = () => {
       const { instance } = useMsal();

       const handleLogin = () => {
         instance.loginPopup(loginRequest).then(() => {
           // Omdirigera till /admin/default efter inloggning
           window.location.href = 'https://hub.mirzamuhic.com/admin/default';
         }).catch((error) => {
           console.error(error);
         });
       };

       return (
         <Flex height="100vh" width="100vw" align="center" justify="center">
           <Box width="50%" p={12} bg="white" boxShadow="xl" borderRadius="md">
             <Image src="/logo.png" alt="Stockholms Basketbollförbund" mb={8} maxH="180px" />
             <Text fontSize="5xl" mb={6} fontWeight="bold">Logga in</Text>
             <Text mb={8} fontSize="xl">Använd ditt Microsoft-konto för att komma åt portalen.</Text>
             <Button colorScheme="blue" onClick={handleLogin} px={10} py={6} fontSize="lg">Logga in med Microsoft</Button>
           </Box>
           <Box width="50%" height="100%" backgroundImage="url('/background.jpg')" backgroundSize="cover" backgroundPosition="center" opacity="0.8" />
         </Flex>
       );
     };

     export default Login;