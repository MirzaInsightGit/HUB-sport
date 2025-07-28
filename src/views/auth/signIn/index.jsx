import React from 'react';
     import { Box, Flex, Heading, Icon, Image, Text, VStack, Button } from '@chakra-ui/react';
     import { FaMicrosoft } from 'react-icons/fa';
     import { useMsal } from '@azure/msal-react';
     import { msalConfig, loginRequest } from '../../../authConfig';
     import BgImage from "../../../assets/img/Mirza-Omer.JPG"; // Bakgrundsbild
     import Logo from "../../../assets/img/Stockholm-BDF-Gra-Liggande-2.png"; // Logotyp

     const SignIn = () => {
       const { instance } = useMsal();

       const handleLogin = () => {
         instance.loginPopup(loginRequest).then(() => {
           window.location.href = 'https://hub.mirzamuhic.com/admin/default';
         }).catch(e => {
           console.error("❌ Login misslyckades:", e);
         });
       };

       return (
         <Flex height="100vh" width="100vw">
           {/* Left panel */}
           <Flex
             flex="1"
             align="center"
             justify="center"
             bg="white"
             direction="column"
             p={10}
           >
             <Heading mb={4} fontSize="3xl" color="gray.800">Logga in</Heading>
             <Text mb={8} color="gray.500">Använd ditt Microsoft-konto för att komma åt portalen.</Text>

             <Button
               leftIcon={<Icon as={FaMicrosoft} />}
               bg="blue.600"
               color="white"
               size="lg"
               w="80%"
               _hover={{ bg: "blue.700" }}
               onClick={handleLogin}
             >
               Logga in med Microsoft
             </Button>

             <Text mt={6} color="gray.400" fontSize="sm">
               © {new Date().getFullYear()} Stockholms Basketbollförbund - Powered by Mirza Muhic
             </Text>
           </Flex>

           {/* Right panel with background and logo */}
           <Flex
             flex="1"
             bgGradient="linear(to-br, #1a202c, #2d3748)"
             backgroundImage={`url(${BgImage})`}
             backgroundSize="cover"
             backgroundPosition="center"
             p={10}
             color="white"
             direction="column"
           >
             <VStack spacing={6}>
               <Image
                 src={Logo}
                 alt="Stockholm Basket"
                 position="absolute"
                 top="40px"
                 left="40px"
                 height="80px"
                 width="auto"
                 objectFit="contain"
               />
             </VStack>
           </Flex>
         </Flex>
       );
     };

     export default SignIn;