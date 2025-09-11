import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Flex,
  Heading,
  Text,
  Tag,
  SimpleGrid,
  useColorModeValue,
  Stack,
  Button,
  Spinner,
} from '@chakra-ui/react';
import { useLocation } from 'react-router-dom';
import Card from 'components/card/Card';

// Helper: read `q` from the URL
function useQueryParam(name) {
  const location = useLocation();
  return useMemo(() => new URLSearchParams(location.search).get(name) || '', [location.search, name]);
}

export default function SearchResults({ items: itemsProp = [], query: queryProp = '' }) {
  const muted = useColorModeValue('gray.600', 'gray.300');
  const border = useColorModeValue('gray.200', 'whiteAlpha.200');

  // If parent passes items/query we use them; otherwise pull from URL and fetch
  const qFromUrl = useQueryParam('q');
  const effectiveQuery = (queryProp || qFromUrl).trim();

  const [items, setItems] = useState(itemsProp);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Keep state in sync if parent provides items
  useEffect(() => {
    if (itemsProp && itemsProp.length) setItems(itemsProp);
  }, [itemsProp]);

  useEffect(() => {
    // If parent did not provide items, fetch from backend using the query in URL
    if (itemsProp && itemsProp.length) return;
    if (!effectiveQuery) {
      setItems([]);
      return;
    }

    const ac = new AbortController();
    async function run() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(effectiveQuery)}&top=24`, {
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Support both shapes: {results:[...]}, {value:[...]}
        const arr = data.results || data.value || [];
        setItems(Array.isArray(arr) ? arr : []);
      } catch (e) {
        if (e.name !== 'AbortError') setError(e.message || 'Fel vid sökning');
      } finally {
        setLoading(false);
      }
    }
    run();
    return () => ac.abort();
  }, [effectiveQuery, itemsProp]);

  const count = items.length;

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <Card mb="20px" p="24px">
        <Flex direction="column" gap={4}>
          {/* Titel och sökterm */}
          <Heading size="lg">Sökresultat</Heading>
          <Text color={muted}>
            {effectiveQuery ? `Du sökte på: "${effectiveQuery}"` : 'Ingen sökterm angiven'}
          </Text>
          <Text fontWeight="bold">
            {loading ? 'Söker…' : count === 0 ? 'Inga träffar' : `${count} träffar`}
          </Text>
          {error && (
            <Text color="red.400" fontSize="sm">{error}</Text>
          )}

          {/* Loading state */}
          {loading && (
            <Flex py={10} justify="center"><Spinner thickness='3px' /></Flex>
          )}

          {/* Tomt state */}
          {!loading && count === 0 && (
            <Card p={6} border="1px solid" borderColor={border}>
              <Text color={muted}>Prova att ändra sökord eller filtrera på annat sätt.</Text>
            </Card>
          )}

          {/* Resultatgrid */}
          {!loading && count > 0 && (
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing="20px" mt={4}>
              {items.map((it, i) => {
                const title = it.title || it.subtitle || it['@search.text'] || 'Utan titel';
                const subtitle = it.subtitle || '';
                const url = it.url || null;
                const tags = Array.isArray(it.tags) ? it.tags : [];

                return (
                  <Card key={i} p={4} _hover={{ transform: 'translateY(-2px)', transition: 'all .15s ease' }}>
                    <Stack spacing={2}>
                      <Heading size="sm" noOfLines={2}>
                        {title}
                      </Heading>
                      {subtitle && (
                        <Text fontSize="sm" color={muted} noOfLines={2}>
                          {subtitle}
                        </Text>
                      )}
                      {tags.length > 0 && (
                        <Flex gap={2} wrap="wrap" pt={2}>
                          {tags.slice(0, 4).map((t, idx) => (
                            <Tag key={idx} size="sm" variant="subtle" colorScheme="blue">
                              {t}
                            </Tag>
                          ))}
                        </Flex>
                      )}
                      <Flex pt={2} justify="flex-end">
                        {url && (
                          <Button as="a" href={url} target="_blank" rel="noreferrer" size="sm">
                            Öppna
                          </Button>
                        )}
                      </Flex>
                    </Stack>
                  </Card>
                );
              })}
            </SimpleGrid>
          )}
        </Flex>
      </Card>
    </Box>
  );
}