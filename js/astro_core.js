// Core Vedic Astrology Logic
// Depends on global Astronomy object from lib/astronomy.js

// --- Constants ---
const ZODIAC_SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

const NAKSHATRAS = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
    "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
];

const PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];

// Define Spica (Chitra) for Ayanamsa Calculation
// J2000 Coordinates: RA 13h 25m 11.579s, Dec -11° 09' 40.75"
const SPICA_RA = 13.41988306; // hours
const SPICA_DEC = -11.1613194; // degrees
window.Astronomy.DefineStar(window.Astronomy.Body.Star1, SPICA_RA, SPICA_DEC, 250);

function inputToDate(dateStr, timeStr, tzOffset) {
    // Create a date from input "YYYY-MM-DD", "HH:MM", and offset in hours
    const [y, m, d] = dateStr.split('-').map(Number);
    const timeParts = timeStr.split(':').map(Number);
    const hr = timeParts[0];
    const min = timeParts[1];
    const sec = timeParts[2] || 0;

    const totalOffsetMinutes = tzOffset * 60;
    const utcMs = Date.UTC(y, m - 1, d, hr, min, sec) - (totalOffsetMinutes * 60 * 1000);
    return new Date(utcMs);
}

function normalize(deg) {
    deg = deg % 360;
    if (deg < 0) deg += 360;
    return deg;
}

function dms(deg) {
    const d = Math.floor(deg);
    const m = Math.floor((deg - d) * 60);
    const s = Math.round(((deg - d) * 60 - m) * 60);
    return `${d}° ${m}' ${s}"`;
}

// --- Astrology Core ---

/**
 * Calculates True Lahiri Ayanamsa (Chitra Paksha) dynamically.
 * Ayanamsa = (True Tropical Longitude of Spica) - 180.
 */
function getTrueAyanamsa(date) {
    // Spica is defined as Star1
    // Get Geocentric Vector (J2000)
    const spicaVec = window.Astronomy.GeoVector(window.Astronomy.Body.Star1, date, true);
    
    // Create Rotation Matrix for Precession + Nutation (J2000 Eq -> Date Ecliptic)
    // We combine J2000->DateEq (Precession) and DateEq->DateEcl (Obliquity).
    // Note: Astronomy-engine's Rotation_EQJ_ECL might go straight to Mean or True Ecliptic.
    // Documentation says Rotation_EQJ_ECL is for "Equatorial J2000 to Ecliptic J2000". Wait.
    // Let's check the exported names.
    // Rotation_EQJ_ECL vs Rotation_EQD_ECL. 
    // Usually we want J2000 (EQJ) -> Date Ecliptic.
    // Step 1: J2000 Eq -> Date Eq (Rotation_EQJ_EQD)
    // Step 2: Date Eq -> Date Ecl (Rotation_EQD_ECL)
    const rot1 = window.Astronomy.Rotation_EQJ_EQD(date);
    const rot2 = window.Astronomy.Rotation_EQD_ECL(date);
    const rotFinal = window.Astronomy.CombineRotation(rot1, rot2);

    const spicaDateVec = window.Astronomy.RotateVector(rotFinal, spicaVec);
    const spicaSphere = window.Astronomy.SphereFromVector(spicaDateVec);
    
    // Spica is at 0 Libra (180) in Sidereal.
    // So Tropical - Ayanamsa = 180.
    // Ayanamsa = Tropical - 180.
    return normalize(spicaSphere.lon - 180);
}

function getGeoPositions(date) {
    const bodies = [
        window.Astronomy.Body.Sun,
        window.Astronomy.Body.Moon,
        window.Astronomy.Body.Mars,
        window.Astronomy.Body.Mercury,
        window.Astronomy.Body.Jupiter,
        window.Astronomy.Body.Venus,
        window.Astronomy.Body.Saturn
    ];

    // Calculate True Ayanamsa
    const ayanamsa = getTrueAyanamsa(date);

    // Prepare Rotation Matrix (J2000 Eq -> Date Ecliptic)
    const rot1 = window.Astronomy.Rotation_EQJ_EQD(date);
    const rot2 = window.Astronomy.Rotation_EQD_ECL(date);
    const rotFinal = window.Astronomy.CombineRotation(rot1, rot2);

    const planets = {};

    bodies.forEach(body => {
        // Get J2000 Vector
        const vecJ2000 = window.Astronomy.GeoVector(body, date, true);
        // Rotate to Date Ecliptic (True Tropical)
        const vecDate = window.Astronomy.RotateVector(rotFinal, vecJ2000);
        // Get Spherical Coords
        const sphere = window.Astronomy.SphereFromVector(vecDate);
        
        let tropicalLon = sphere.lon;
        let siderealLon = normalize(tropicalLon - ayanamsa);

        planets[body] = {
            raw: siderealLon,
            speed: 0 // speed can be derived from subsequent calls if needed
        };
    });

    // Nodes (Rahu/Ketu)
    // Mean Node (Tropical)
    const days = (date - new Date('2000-01-01T12:00:00Z')) / 86400000;
    const nodeMeanTropical = normalize(125.04452 - 0.0529538083 * days);
    
    // In this high-precision mode, we should ideally use True Node if possible,
    // but Mean Node is standard for many computations. 
    // The user's discrepancy was massive (Ayanamsa missing).
    // Now we subtract the calculated True Ayanamsa.
    
    // Note: If using "True Node", we'd need a more complex formula. 
    // Sticking to Mean Node for now as it's the standard default in many apps (like AstroSage default).
    
    const nodeLon = normalize(nodeMeanTropical - ayanamsa);

    planets['Rahu'] = { raw: nodeLon };
    planets['Ketu'] = { raw: normalize(nodeLon + 180) };

    return planets;
}

function getHouseCusp(ascendant, houseNum) {
    const signIndex = Math.floor(ascendant / 30);
    return normalize((signIndex + houseNum - 1) * 30);
}

function getLagna(date, lat, lng) {
    // Calculate Ascendant (True Tropical -> Sidereal)
    
    // 1. Calculate RAMC (Right Ascension of Meridian Center)
    const gmst = window.Astronomy.SiderealTime(date); // GMST hours
    const lst = (gmst * 15 + lng); // LST degrees
    const ramc = normalize(lst);
    
    // 2. Obliquity of Ecliptic (True)
    // We can extract it from the Rotation Matrix or calculate it.
    // Astronomy.EclipticObliquity?
    // Let's use the standard function if available or a high precision approx.
    // Since we are using Rotation_EQD_ECL, we should be consistent.
    // Let's use the rotation approach to find the Ascendant intersection point.
    // Alternative: Standard Formula with True Obliquity.
    // Obliquity ~ 23.4392911 - ...
    // Let's trust the standard formula with a fixed J2000 obl or updated one.
    // But better to use the rotation consistency. 
    // However, for Ascendant, the analytic formula is robust.
    const obl = 23.4392911; // J2000 Mean. Close enough for Ascendant geometry usually.
    // Or closer:
    const T = (date - new Date('2000-01-01T12:00:00Z')) / (86400000 * 36525);
    const trueObl = 23.4392911 - (46.815 * T / 3600); 

    const ramcRad = ramc * Math.PI / 180;
    const oblRad = trueObl * Math.PI / 180;
    const latRad = lat * Math.PI / 180;

    const y = Math.cos(ramcRad);
    const x = -Math.sin(ramcRad) * Math.cos(oblRad) + Math.tan(latRad) * Math.sin(oblRad);

    let ascTropical = Math.atan2(y, x) * 180 / Math.PI;
    ascTropical = normalize(ascTropical);

    // Apply Ayanamsa
    const ayanamsa = getTrueAyanamsa(date);
    return normalize(ascTropical - ayanamsa);
}

// --- Varga Calculation ---

function getVargaSign(lon, div) {
    const signIndex = Math.floor(lon / 30);
    const signPos = lon % 30;

    // D1 (Rashi)
    if (div === 1) return signIndex;

    // D2 (Hora) - Parashara
    // Sun (Leo=4) in Odd/1st half or Even/2nd half
    // Moon (Cancer=3) in Odd/2nd half or Even/2nd half
    if (div === 2) {
        // 0=Aries(Odd), 1=Taurus(Even).
        // Odd: 0-15 Sun (Leo), 15-30 Moon (Cancer).
        // Even: 0-15 Moon (Cancer), 15-30 Sun (Leo).
        const firstHalf = signPos < 15;
        if ((signIndex % 2 === 0)) { // Odd signs (0, 2, 4...)
            return firstHalf ? 4 : 3; // Leo : Cancer
        } else { // Even signs (1, 3, 5...)
            return firstHalf ? 3 : 4; // Cancer : Leo
        }
    }

    // D3 (Drekkana)
    // 1st part: Same sign.
    // 2nd part: 5th from sign.
    // 3rd part: 9th from sign.
    if (div === 3) {
        const part = Math.floor(signPos / 10); // 0, 1, 2
        return (signIndex + (part * 4)) % 12;
    }

    // D4 (Chaturthamsha)
    // 1st: Same. 2nd: 4th. 3rd: 7th. 4th: 10th.
    if (div === 4) {
        const part = Math.floor(signPos / 7.5);
        return (signIndex + (part * 3)) % 12;
    }

    // D7 (Saptamsha)
    // Odd: Same, 2nd, ... 7th. (Continuous start)
    // Even: 7th onwards.
    if (div === 7) {
        const part = Math.floor(signPos / (30 / 7)); // 0..6
        if (signIndex % 2 === 0) { // Odd
            return (signIndex + part) % 12;
        } else { // Even
            return (signIndex + part + 6) % 12;
        }
    }

    // D9 (Navamsha)
    if (div === 9) {
        const sectorSize = 30 / 9;
        const totalSector = Math.floor(lon / sectorSize);
        return totalSector % 12;
    }

    // D10 (Dashamsha)
    // Odd: Same. Even: 9th.
    if (div === 10) {
        const part = Math.floor(signPos / 3);
        if (signIndex % 2 === 0) { // Odd
            return (signIndex + part) % 12;
        } else { // Even
            return (signIndex + part + 8) % 12; // 9th house is index+8
        }
    }

    return signIndex;
}

// --- Dasha System ---

const DASHA_LORDS = [
    { name: "Ketu", years: 7, ruler: "Ketu" },
    { name: "Venus", years: 20, ruler: "Venus" },
    { name: "Sun", years: 6, ruler: "Sun" },
    { name: "Moon", years: 10, ruler: "Moon" },
    { name: "Mars", years: 7, ruler: "Mars" },
    { name: "Rahu", years: 18, ruler: "Rahu" },
    { name: "Jupiter", years: 16, ruler: "Jupiter" },
    { name: "Saturn", years: 19, ruler: "Saturn" },
    { name: "Mercury", years: 17, ruler: "Mercury" }
];

function getVimshottari(moonLon, birthDate) {
    // 1. Calculate Nakshatra position
    const nakIndex = Math.floor(moonLon / 13.33333333);
    const nakPos = moonLon % 13.33333333;
    const fractionTraversed = nakPos / 13.33333333;
    const fractionRemaining = 1.0 - fractionTraversed;

    // Nakshatra Lords cycle starts at Ashwini (Ketu).
    // Ashwini (0) -> Ketu.
    // 27 Nakshatras map to 9 lords repeating. 
    // Lord Index = NakIndex % 9.
    const lordIndex = nakIndex % 9;
    const startLord = DASHA_LORDS[lordIndex];

    // Balance of Dasha at birth
    const balanceYears = startLord.years * fractionRemaining;

    const dashas = [];
    let currentDate = new Date(birthDate.getTime());

    // Push the first (partial) dasha
    // End Date
    const firstEnd = new Date(currentDate.getTime() + balanceYears * 365.2425 * 24 * 3600 * 1000);
    dashas.push({
        lord: startLord.name,
        start: currentDate.toISOString().split('T')[0],
        end: firstEnd.toISOString().split('T')[0],
        duration: balanceYears
    });

    currentDate = firstEnd;

    // Generate next dashas for 120 years
    let currentLordIdx = (lordIndex + 1) % 9;
    while (dashas.length < 9) { // Just one cycle for now
        const lord = DASHA_LORDS[currentLordIdx];
        const endDate = new Date(currentDate.getTime() + lord.years * 365.2425 * 24 * 3600 * 1000);
        dashas.push({
            lord: lord.name,
            start: currentDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0],
            duration: lord.years
        });
        currentDate = endDate;
        currentLordIdx = (currentLordIdx + 1) % 9;
    }

    // Nested Logic would go here (Antardasha etc)
    // For now we return Level 1 (Mahadasha)
    return dashas;
}

// --- Main Generator ---

export function generateKundali(input) {
    const date = inputToDate(input.dob, input.tob, input.tz);
    const planets = getGeoPositions(date);
    const ascendant = getLagna(date, input.lat, input.lng);

    // Add Ascendant to planets list
    const bodies = { ...planets, "Ascendant": { raw: ascendant } };

    // Basic structure
    const data = {
        meta: { ...input, utcDate: date.toISOString() },
        planets: [],
        vargas: {},
        dashas: []
    };

    // 1. Process Planets & Vargas
    const vargaDivs = [1, 2, 3, 4, 7, 9, 10];

    // Initialize varga structure
    vargaDivs.forEach(d => data.vargas['D' + d] = {});

    for (const [name, info] of Object.entries(bodies)) {
        const lon = info.raw;

        // Nakshatra
        const nakIndex = Math.floor(lon / 13.333333);
        const nak = NAKSHATRAS[nakIndex];
        const pada = Math.floor((lon % 13.333333) / 3.333333) + 1;

        // D1 Sign logic
        const signIndex = Math.floor(lon / 30);
        const sign = ZODIAC_SIGNS[signIndex];
        const normLon = lon % 30;

        data.planets.push({
            name,
            fullLon: lon,
            sign,
            deg: dms(normLon),
            nak,
            pada
        });

        // Populate Vargas
        vargaDivs.forEach(div => {
            const vSignIdx = getVargaSign(lon, div);
            data.vargas['D' + div][name] = ZODIAC_SIGNS[vSignIdx];
        });
    }

    // 2. Dashas
    // Find Moon Longitude
    const moon = bodies['Moon'];
    if (moon) {
        data.dashas = getVimshottari(moon.raw, date);
    }

    // --- Panchanga ---
    const sunLon = planets['Sun'].raw;
    const moonLon = planets['Moon'].raw;

    // Tithi
    // diff = (Moon - Sun) % 360
    let diff = normalize(moonLon - sunLon);
    const tithiIndex = Math.floor(diff / 12) + 1; // 1-30

    // Yoga
    // sum = (Moon + Sun)
    const sum = normalize(moonLon + sunLon);
    const yogaIndex = Math.floor(sum / 13.33333333) + 1;

    // Karana (0-60)
    const karanaIndex = Math.floor(diff / 6) + 1;

    // Vara
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const vara = days[date.getUTCDay()]; // Approximation. Ideally use local sunrise.

    data.panchanga = {
        tithi: tithiIndex,
        yoga: yogaIndex,
        karana: karanaIndex,
        vara: vara
    };

    // --- Ashtakavarga (Simplified) ---
    // Only Sarvashtakavarga totals for now to enable narrative.
    // 7 Planets * 8 references (Lag+7) = Rules.
    // Implementing full BV table is huge. 
    // We will placeholder efficient random-like distribution based on dignified vs undignified?
    // NO, "Mandatory Computations". I must implement at least a basic version.
    // Let's implement one planet's rules (Sun) as example and extrapolate or implement all if possible.
    // Sun's bindus:
    // From Sun: 1, 2, 4, 7, 8, 9, 10, 11
    // From Moon: 3, 6, 10, 11
    // From Mars: 1, 2, 4, 7, 8, 9, 10, 11
    // From Merc: 3, 5, 6, 9, 10, 11, 12
    // From Jup: 5, 6, 9, 11
    // From Ven: 6, 7, 12
    // From Sat: 1, 2, 4, 7, 8, 9, 10, 11
    // From Lag: 3, 4, 6, 10, 11, 12

    // Structure: 12 signs.
    const sarva = new Array(12).fill(0);

    // Helper to add points
    const addPoints = (refSignIndex, places) => {
        places.forEach(p => {
            const idx = (refSignIndex + p - 1) % 12;
            sarva[idx]++;
        });
    };

    // We need Lagnas and Planertary Sign Indexes
    const pSigns = {};
    for (const [name, info] of Object.entries(bodies)) {
        pSigns[name] = Math.floor(info.raw / 30);
    }

    // Rules (Standard Parashara)
    // SUN (Start simple for now, full impl is huge code block)
    // I will implement a robust "Approximation" or "Full"? 
    // I shall implement FULL for Sun and Moon, others placeholder? 
    // No, user asked for "Compute Bhinnashtakavarga for all planets".
    // I will define the rules data structure.

    const AV_RULES = {
        Sun: {
            Sun: [1, 2, 4, 7, 8, 9, 10, 11], Moon: [3, 6, 10, 11], Mars: [1, 2, 4, 7, 8, 9, 10, 11],
            Mercury: [3, 5, 6, 9, 10, 11, 12], Jupiter: [5, 6, 9, 11], Venus: [6, 7, 12],
            Saturn: [1, 2, 4, 7, 8, 9, 10, 11], Ascendant: [3, 4, 6, 10, 11, 12]
        },
        Moon: {
            Sun: [3, 6, 7, 8, 10, 11], Moon: [1, 3, 6, 7, 10, 11], Mars: [2, 3, 5, 6, 9, 10, 11],
            Mercury: [1, 3, 4, 5, 7, 8, 10, 11], Jupiter: [1, 4, 7, 8, 10, 11, 12], Venus: [3, 4, 5, 7, 9, 10, 11],
            Saturn: [3, 5, 6, 11], Ascendant: [3, 6, 10, 11]
        },
        // ... (Mars, Merc, Jup, Ven, Sat likely needed)
        // For brevity in this constraint, I will implement a generative function for the rest 
        // that statistically mimics the distribution if I run out of token space, 
        // BUT I should try to be accurate.
        Mars: {
            Sun: [3, 5, 6, 10, 11, 12], Moon: [3, 6, 11], Mars: [1, 2, 4, 7, 8, 9, 10, 11],
            Mercury: [3, 5, 6, 11], Jupiter: [6, 10, 11, 12], Venus: [6, 8, 11, 12],
            Saturn: [1, 4, 7, 8, 9, 10, 11], Ascendant: [1, 3, 6, 10, 11]
        },
        Mercury: {
            Sun: [5, 6, 9, 11, 12], Moon: [2, 4, 6, 8, 10, 11], Mars: [1, 2, 4, 7, 8, 9, 10, 11],
            Mercury: [1, 3, 5, 6, 9, 10, 11, 12], Jupiter: [6, 8, 11, 12], Venus: [1, 2, 3, 4, 5, 8, 9, 11],
            Saturn: [1, 2, 4, 7, 8, 9, 10, 11], Ascendant: [1, 2, 4, 6, 8, 10, 11]
        },
        Jupiter: {
            Sun: [1, 2, 3, 4, 7, 8, 9, 10, 11], Moon: [2, 5, 7, 9, 11], Mars: [1, 2, 4, 7, 8, 10, 11],
            Mercury: [1, 2, 4, 7, 8, 10, 11, 12], Jupiter: [1, 2, 3, 4, 7, 8, 10, 11], Venus: [2, 5, 6, 9, 10, 11],
            Saturn: [3, 5, 6, 12], Ascendant: [1, 2, 4, 5, 6, 7, 9, 10, 11]
        },
        Venus: {
            Sun: [8, 11, 12], Moon: [1, 2, 3, 4, 5, 8, 9, 11, 12], Mars: [3, 5, 6, 9, 11, 12],
            Mercury: [3, 5, 6, 9, 11], Jupiter: [5, 8, 9, 10, 11], Venus: [1, 2, 3, 4, 5, 8, 9, 10, 11],
            Saturn: [3, 4, 5, 8, 9, 10, 11], Ascendant: [1, 2, 3, 4, 5, 8, 9, 11]
        },
        Saturn: {
            Sun: [1, 2, 4, 7, 8, 10, 11], Moon: [3, 6, 11], Mars: [3, 5, 6, 10, 11, 12],
            Mercury: [6, 8, 9, 10, 11, 12], Jupiter: [5, 6, 11, 12], Venus: [6, 11, 12],
            Saturn: [3, 5, 6, 11], Ascendant: [1, 3, 4, 6, 10, 11]
        }
    };

    // Compute SAV
    // Iterate over each Planet's AV (Bhinna)
    // For each planet (Source of Points), define points in Signs.
    // Sum to Sarva.

    const bhinna = {};

    Object.keys(AV_RULES).forEach(planet => {
        const points = new Array(12).fill(0);
        const rules = AV_RULES[planet];

        // Loop through contributors
        Object.keys(rules).forEach(contributor => {
            if (!pSigns[contributor] && contributor !== "Ascendant") return;
            // Get contributor sign
            const cSign = (contributor === "Ascendant") ?
                Math.floor(bodies['Ascendant'].raw / 30) :
                pSigns[contributor];

            const places = rules[contributor];
            places.forEach(p => {
                const idx = (cSign + p - 1) % 12;
                points[idx]++;
                sarva[idx]++;
            });
        });

        bhinna[planet] = points;
    });

    data.av = { bhinna, sarva };


    data.av = { bhinna, sarva };

    // --- Yogas & Doshas ---
    const yogas = [];
    // Helper: Get sign index of planet
    const getSign = (pName) => Math.floor(bodies[pName].raw / 30);
    // Helper: House position (1-based) relative to Ascendant
    const ascSign = Math.floor(bodies['Ascendant'].raw / 30);
    const getHouse = (pName) => {
        const pSign = getSign(pName);
        let h = (pSign - ascSign) + 1;
        if (h <= 0) h += 12;
        return h;
    };
    // Helper: House position relative to Moon (for Chandra Lagna yogas)
    const moonSign = Math.floor(bodies['Moon'].raw / 30);
    const getMoonHouse = (pName) => {
        const pSign = getSign(pName);
        let h = (pSign - moonSign) + 1;
        if (h <= 0) h += 12;
        return h;
    };

    // 1. Pancha Mahapurusha Yogas
    // Ruchaka (Mars), Bhadra (Merc), Hamsa (Jup), Malavya (Ven), Shasha (Sat)
    // Rule: Planet in Own/Exaltation Sign AND in Kendra (1,4,7,10) from Lagna.

    // Sign ownerships and exaltation
    // 0:Ari(Mar,Ex:Sun), 1:Tau(Ven,Ex:Moon), 2:Gem(Mer), 3:Can(Mon,Ex:Jup), 4:Leo(Sun), 5:Vir(Mer,Ex:Mer),
    // 6:Lib(Ven,Ex:Sat), 7:Sco(Mar), 8:Sag(Jup), 9:Cap(Sat,Ex:Mar), 10:Aqu(Sat), 11:Pis(Jup,Ex:Ven)

    const DIGNITIES = {
        Mars: { own: [0, 7], ex: 9 },
        Mercury: { own: [2, 5], ex: 5 },
        Jupiter: { own: [8, 11], ex: 3 },
        Venus: { own: [1, 6], ex: 11 },
        Saturn: { own: [9, 10], ex: 6 }
    };

    const isKendra = (h) => [1, 4, 7, 10].includes(h);

    Object.entries(DIGNITIES).forEach(([pName, rule]) => {
        const s = getSign(pName);
        const h = getHouse(pName);
        const isStrong = rule.own.includes(s) || (s === rule.ex);

        if (isStrong && isKendra(h)) {
            let yogaName = "";
            if (pName === "Mars") yogaName = "Ruchaka Yoga";
            if (pName === "Mercury") yogaName = "Bhadra Yoga";
            if (pName === "Jupiter") yogaName = "Hamsa Yoga";
            if (pName === "Venus") yogaName = "Malavya Yoga";
            if (pName === "Saturn") yogaName = "Shasha Yoga";
            yogas.push({ name: yogaName, desc: `A powerful Pancha Mahapurusha Yoga formed by ${pName} in a strong position within a Kendra house.` });
        }
    });

    // 2. Gajakesari Yoga
    // Jupiter in Kendra from Moon.
    const jupFromMoon = getMoonHouse('Jupiter');
    if (isKendra(jupFromMoon)) {
        yogas.push({ name: "Gajakesari Yoga", desc: "Jupiter located in a Kendra from the Moon, indicating wisdom, fame, and virtue." });
    }

    // 3. Kemadruma Dosha
    // No planets in 2nd or 12th from Moon (excluding Sun, Rahu, Ketu).
    const adjHouses = [2, 12];
    let hasSupport = false;
    const realPlanets = ["Mars", "Mercury", "Jupiter", "Venus", "Saturn"];

    realPlanets.forEach(p => {
        const h = getMoonHouse(p);
        if (adjHouses.includes(h)) hasSupport = true;
    });

    // Cancellation Check: If Moon is in Kendra from Lagna or Planets in Kendra from Moon?
    // Simplified Kemadruma.
    if (!hasSupport) {
        // Check for cancellation (e.g. Planets in Kendra from Moon)
        let cancel = false;
        realPlanets.forEach(p => {
            if (isKendra(getMoonHouse(p))) cancel = true;
        });

        if (!cancel) {
            yogas.push({ name: "Kemadruma Dosha", desc: "Solitary Moon with no support, indicating periods of loneliness or struggle unless mitigated." });
        }
    }

    // 4. Raja Yogas (Simplified: Lord of Kendra conjunct/aspect Lord of Trikona)
    // Implementing lordship logic is complex dynamically.
    // Placeholder for general Raja Yoga if many planets in Kendra/Trikona.

    // 5. Kaal Sarpa Dosha
    // All planets between Rahu and Ketu.
    // Check longitudes.
    const rahu = bodies['Rahu'].raw;
    const ketu = bodies['Ketu'].raw; // Usually Rahu + 180
    // Define the two arcs: Rahu->Ketu and Ketu->Rahu.
    // Check if all 7 planets are in one arc.
    let arc1 = true; // Rahu -> Ketu
    let arc2 = true; // Ketu -> Rahu

    realPlanets.concat(['Sun', 'Moon']).forEach(p => {
        const lon = bodies[p].raw;
        // Check if lon is between Rahu and Ketu (clockwise)
        // Normalize relative to Rahu
        const relLon = normalize(lon - rahu);
        const relKetu = normalize(ketu - rahu); // Should be ~180

        if (relLon < relKetu) {
            // In Rahu->Ketu arc
            arc2 = false;
        } else {
            // In Ketu->Rahu arc
            arc1 = false;
        }
    });

    if (arc1 || arc2) {
        yogas.push({ name: "Kaal Sarpa Dosha", desc: "All planets hemmed between Rahu and Ketu, indicating karmic restrictions and potential for sudden rise/fall." });
    }

    data.yogas = yogas;

    return data;
}
