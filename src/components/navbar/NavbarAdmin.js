// Chakra Imports
import { Box, Breadcrumb, BreadcrumbItem, BreadcrumbLink, Flex, Image, Text, useColorModeValue, Input, InputGroup, InputLeftElement } from '@chakra-ui/react';
import PropTypes from 'prop-types';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import AdminNavbarLinks from 'components/navbar/NavbarLinksAdmin';
import { useLocation, NavLink as RouterNavLink, useNavigate } from 'react-router-dom';
import routes from 'routes';
import { MdSearch } from 'react-icons/md';

export default function AdminNavbar(props) {
	const [ scrolled, setScrolled ] = useState(false);
	const [ search, setSearch ] = useState('');
	const API_BASE = process.env.REACT_APP_API_BASE || '/api';
	const SIDEBAR_WIDTH = '72px';
	const NAVBAR_MARGIN = '30px';

	const [suggestions, setSuggestions] = useState([]);
	const [isSuggesting, setIsSuggesting] = useState(false);
	const [showSuggest, setShowSuggest] = useState(false);
	const [highlighted, setHighlighted] = useState(-1);
	const inputRef = useRef(null);

	useEffect(() => {
		window.addEventListener('scroll', changeNavbar);

		return () => {
			window.removeEventListener('scroll', changeNavbar);
		};
	});

	const { secondary, message, brandText } = props;

	// Here are all the props that may change depending on navbar's type or state.(secondary, variant, scrolled)
	let mainText = useColorModeValue('navy.700', 'white');
	let secondaryText = useColorModeValue('gray.700', 'white');
	const crumbInactive = useColorModeValue('gray.500', 'gray.300');
	const crumbActive = useColorModeValue('navy.700', 'white');
	const crumbSeparator = useColorModeValue('gray.300', 'whiteAlpha.400');
	let navbarPosition = 'fixed';
	let navbarFilter = 'none';
	let navbarBackdrop = 'blur(20px)';
	let navbarShadow = 'none';
	let navbarBg = useColorModeValue('rgba(244, 247, 254, 0.2)', 'rgba(11,20,55,0.5)');
	let navbarBorder = 'transparent';
	let secondaryMargin = '0px';
	let paddingX = '15px';
	let gap = '0px';
	const changeNavbar = () => {
		if (window.scrollY > 1) {
			setScrolled(true);
		} else {
			setScrolled(false);
		}
	};

	const location = useLocation();
	const navigate = useNavigate();

	// Flatten routes (including nested items)
	const allRoutes = React.useMemo(() => {
		const out = [];
		const walk = (arr) => {
			arr.forEach((r) => {
				if (!r) return;
				if (r.layout && r.path) out.push({ layout: r.layout, path: r.path, name: r.name });
				if (Array.isArray(r.items)) walk(r.items);
			});
		};
		walk(routes || []);
		return out;
	}, []);

	const findName = (layout, path) => {
		const hit = allRoutes.find((r) => r.layout === layout && r.path === path);
		if (hit && hit.name) return hit.name;
		// Fallback: prettify segment
		return decodeURIComponent(path.replace(/\//g, '')).replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) || 'Start';
	};

	const buildCrumbs = (pathname) => {
		// Expect paths like /admin/default, /admin/notifications, /coach/...
		const segs = pathname.split('?')[0].split('#')[0].split('/').filter(Boolean);
		if (segs.length === 0) return [{ label: 'Home', to: '/' }];
		const layout = '/' + segs[0];
		const rest = segs.slice(1);

		const crumbs = [];
		// Root item (Admin/Coach) links back to layout root
		const rootLabel = layout === '/admin' ? 'Admin' : findName(layout, '/');
		crumbs.push({ label: rootLabel, to: layout });

		let acc = '';
		rest.forEach((s, idx) => {
			acc += '/' + s;
			const label = findName(layout, '/' + s) || s;
			crumbs.push({ label, to: layout + acc });
		});

		return crumbs;
	};

	const handleSearchSubmit = (e) => {
		e.preventDefault();
		const q = search.trim();
		if (!q) return;
		// Navigera till resultatsidan
		navigate(`/admin/search?q=${encodeURIComponent(q)}`);
		setShowSuggest(false);
		setHighlighted(-1);
	};

	const getLabel = (item) => item?.["@search.text"] || item?.text || item?.title || item?.subtitle || '';

	const debounce = (fn, ms) => {
		let t;
		return (...args) => {
			clearTimeout(t);
			t = setTimeout(() => fn(...args), ms);
		};
	};

	const triggerSuggest = useMemo(() => debounce(async (q) => {
		if (!q || q.length < 2) {
			setSuggestions([]);
			setShowSuggest(false);
			setHighlighted(-1);
			return;
		}
		try {
			setIsSuggesting(true);
			const res = await fetch(`${API_BASE}/search/suggest?q=${encodeURIComponent(q)}&top=8`);
			const data = await res.json();
			const list = Array.isArray(data?.value) ? data.value : [];
			setSuggestions(list);
			setShowSuggest(true);
			setHighlighted(-1);
		} catch (e) {
			console.error('Suggest failed', e);
		} finally {
			setIsSuggesting(false);
		}
	}, 250), [API_BASE]);

	return (
		<Box
			position={navbarPosition}
			boxShadow={navbarShadow}
			bg={navbarBg}
			borderColor={navbarBorder}
			filter={navbarFilter}
			backdropFilter={navbarBackdrop}
			backgroundPosition='center'
			backgroundSize='cover'
			borderRadius='16px'
			borderWidth='1.5px'
			borderStyle='solid'
			zIndex={1000}
			transitionDelay='0s, 0s, 0s, 0s'
			transitionDuration=' 0.25s, 0.25s, 0.25s, 0s'
			transition-property='box-shadow, background-color, filter, border'
			transitionTimingFunction='linear, linear, linear, linear'
			alignItems={{ xl: 'center' }}
			display={secondary ? 'block' : 'flex'}
			minH='80px'
			justifyContent={{ xl: 'center' }}
			lineHeight='25.6px'
			mx='auto'
			mt={secondaryMargin}
			pb='8px'
			left={{ base: '12px', md: '16px', lg: '20px', xl: `calc(${SIDEBAR_WIDTH} + ${NAVBAR_MARGIN})` }}
			right={{ base: '12px', md: '30px', lg: '30px', xl: '30px' }}
			px={{
				sm: paddingX,
				md: '10px'
			}}
			ps={{
				xl: '12px'
			}}
			pt='8px'
			top={{ base: '12px', md: '16px', lg: '20px', xl: '20px' }}
			w={{
				base: 'calc(100vw - 6%)',
				md: 'calc(100vw - 8%)',
				lg: 'calc(100vw - 6%)',
				xl: `calc(100vw - ${SIDEBAR_WIDTH} - ${NAVBAR_MARGIN} - 30px)`,
				'2xl': `calc(100vw - ${SIDEBAR_WIDTH} - ${NAVBAR_MARGIN} - 30px)`
			}}>
			<Flex w="100%" mb={gap} position="relative">
  <Box
    as={Flex}
    w="100%"
    align="center"
    gap={4}
    sx={{
      display: 'grid',
      gridTemplateColumns: '1fr 720px 1fr',
      alignItems: 'center',
      columnGap: '16px',
      width: '100%'
    }}
  >
    {/* Vänster: logo + breadcrumbs + titel */}
    <Box minW={0}>
      <Flex align="center" gap={3} mb={1}>
        <Image
          src={require('assets/img/Stockholm-BDF-Gra-Liggande-2.png')}
          alt="Stockholm Basket"
          h="24px"
          maxW="180px"
          objectFit="contain"
        />
        <Breadcrumb separator={<Text color={crumbSeparator}>/</Text>} overflow="hidden">
          {buildCrumbs(location.pathname).map((c, i, arr) => (
            <BreadcrumbItem key={c.to} isCurrentPage={i === arr.length - 1}>
              {i === arr.length - 1 ? (
                <Text color={crumbActive} noOfLines={1}>{c.label}</Text>
              ) : (
                <BreadcrumbLink
                  as={RouterNavLink}
                  to={c.to}
                  color={crumbInactive}
                  _hover={{ color: crumbActive }}
                >
                  {c.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          ))}
        </Breadcrumb>
      </Flex>
      <Text color={mainText} fontWeight="bold" fontSize="34px" noOfLines={1}>
        {buildCrumbs(location.pathname).slice(-1)[0]?.label}
      </Text>
    </Box>

    {/* Mitten: Sök (inte absolute) */}
    <Box position="relative" w="100%" display={{ base: 'none', md: 'block' }} sx={{ justifySelf: 'center' }}>
      <form onSubmit={handleSearchSubmit} style={{ width: '100%' }}>
        <InputGroup w="100%" maxW="760px" mx="auto">
          <InputLeftElement pointerEvents="none">
            <MdSearch />
          </InputLeftElement>
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => { const q = e.target.value; setSearch(q); triggerSuggest(q); }}
            onFocus={() => { if (suggestions.length) setShowSuggest(true); }}
            onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (highlighted >= 0 && suggestions[highlighted]) {
                  const pick = suggestions[highlighted];
                  const label = getLabel(pick);
                  setShowSuggest(false);
                  setHighlighted(-1);
                  if (pick.url) window.location.href = pick.url;
                  else if (label) navigate(`/admin/search?q=${encodeURIComponent(label)}`);
                } else {
                  const q = (e.currentTarget.value || '').trim();
                  if (q) navigate(`/admin/search?q=${encodeURIComponent(q)}`);
                }
                return;
              }
              if (!showSuggest || !suggestions.length) return;
              if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => (h + 1) % suggestions.length); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => (h - 1 + suggestions.length) % suggestions.length); }
              else if (e.key === 'Escape') { setShowSuggest(false); }
            }}
            placeholder="Sök i HUB…"
            bg="white"
            _dark={{ bg: 'navy.700', color: 'white' }}
            borderRadius="full"
            size="lg"
            h="44px"
            _focus={{ boxShadow: '0 0 0 4px rgba(59,130,246,0.2)', borderColor: 'blue.400' }}
          />
        </InputGroup>
      </form>

      {(showSuggest && (suggestions.length > 0 || isSuggesting)) && (
        <Box
          position="absolute"
          top="52px"
          left={0}
          w="100%"
          bg="white"
          _dark={{ bg: 'navy.800' }}
          borderRadius="md"
          boxShadow="lg"
          zIndex={30}
          maxH="320px"
          overflowY="auto"
        >
          {isSuggesting && (
            <Box px={3} py={2}><Text fontSize="sm" color="gray.500">Söker…</Text></Box>
          )}
          {suggestions.map((s, idx) => {
            const label = getLabel(s);
            return (
              <Flex
                key={idx}
                align="center"
                px={3}
                py={2}
                cursor="pointer"
                bg={idx === highlighted ? 'blackAlpha.100' : 'transparent'}
                _dark={{ bg: idx === highlighted ? 'whiteAlpha.200' : 'transparent' }}
                _hover={{ bg: 'blackAlpha.50', _dark: { bg: 'whiteAlpha.200' } }}
                onMouseEnter={() => setHighlighted(idx)}
                onMouseLeave={() => setHighlighted(-1)}
                onMouseDown={(e) => { e.preventDefault(); }}
                onClick={() => {
                  const lbl = getLabel(s);
                  setShowSuggest(false);
                  setHighlighted(-1);
                  if (s.url) window.location.href = s.url;
                  else if (lbl) navigate(`/admin/search?q=${encodeURIComponent(lbl)}`);
                }}
              >
                <Text fontSize="sm" noOfLines={1}>{label}</Text>
              </Flex>
            );
          })}
        </Box>
      )}
    </Box>

    {/* Höger: notiser/länkar */}
    <Box justifySelf="end" alignSelf="center" display="flex" alignItems="center" h="44px">
      <Flex align="center" justify="center" w="44px" h="44px">
        <AdminNavbarLinks
          onOpen={props.onOpen}
          logoText={props.logoText}
          secondary={props.secondary}
          fixed={props.fixed}
          scrolled={scrolled}
        />
      </Flex>
    </Box>
  </Box>
</Flex>
			{secondary ? <Text color='white'>{message}</Text> : null}
		</Box>
	);
}

AdminNavbar.propTypes = {
	brandText: PropTypes.string,
	variant: PropTypes.string,
	secondary: PropTypes.bool,
	fixed: PropTypes.bool,
	onOpen: PropTypes.func
};
