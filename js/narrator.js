// narrator.js - Converts Astro Data to Verbal Kundali

export function narrateKundali(data) {
    if (!data) return "Unable to generate horoscope.";

    const { meta, planets, vargas, dashas, av, panchanga, yogas } = data;

    // Helpers
    const getPlanet = (name) => planets.find(p => p.name === name);
    const ascendant = getPlanet('Ascendant');
    const moon = getPlanet('Moon');
    const sun = getPlanet('Sun');

    // Section 1: Introduction & Panchanga
    let narrative = `
        <div class="narrative-section">
            <h3 class="section-title">I. Panchanga & Birth Context</h3>
            <p>
                The native, <strong>${meta.fullName}</strong>, entered this world on a ${panchanga.vara}. 
                The lunar day (Tithi) was the ${formatOrdinal(panchanga.tithi)} Tithi, 
                marked by the configuration of the Sun and Moon. 
                At the time of birth, the Moon was transiting the star (Nakshatra) of <strong>${moon.nak}</strong>, 
                positioned in the ${formatOrdinal(moon.pada)} Pada.
            </p>
            <p>
                The Yoga active was the ${formatOrdinal(panchanga.yoga)} Yoga, 
                and the Karana was the ${formatOrdinal(panchanga.karana)} Karana. 
                These elements collectively shape the fundamental temperament, conferring a distinct karmic imprint upon the soul's journey.
            </p>
        </div>
    `;

    // Section 2: Lagna & Moon (The Foundation)
    narrative += `
        <div class="narrative-section">
            <h3 class="section-title">II. The Ascendant & Lunar Foundation</h3>
            <p>
                The Ascendant (Lagna), representing the physical self and general orientation, falls in the sign of <strong>${ascendant.sign}</strong> (${ascendant.deg}).
                This placement suggests a personality rooted in the qualities of ${ascendant.sign}. 
                In the Navamsha (D9) chart, the Ascendant lord shifts to <strong>${vargas.D9['Ascendant']}</strong>, 
                modifying the inner strength and direction of the life path.
            </p>
            <p>
                The Moon, the significator of the mind and emotions, is situated in <strong>${moon.sign}</strong>. 
                Possessing the qualities of this sign, the emotional nature is filtered through the lens of ${moon.sign}'s ruler.
                The Moon's Nakshatra, ${moon.nak}, further refines the mental constitution and emotional responses.
            </p>
        </div>
    `;

    // Section 3: Planetary Placements
    narrative += `
        <div class="narrative-section">
            <h3 class="section-title">III. Planetary Configurations</h3>
            <p>The celestial council is arranged as follows:</p>
    `;

    planets.forEach(p => {
        if (p.name === 'Ascendant') return;
        narrative += `
            <p>
                <strong>${p.name}</strong> resides in the sign of <strong>${p.sign}</strong> at ${p.deg}. 
                It traverses the Nakshatra of ${p.nak} (Pada ${p.pada}).
                In the Navamsha, ${p.name} moves to the sign of <strong>${vargas.D9[p.name]}</strong>, 
                revealing its deeper, internal strength.
            </p>
        `;
    });
    narrative += `</div>`;

    // Section 4: Divisional Charts (Vargas)
    narrative += `
        <div class="narrative-section">
            <h3 class="section-title">IV. Divisional Strengths (Vargas)</h3>
            <p>
                Beyond the Rashi chart, the subtle bodies are revealed in the Divisional Charts.
                In the Hora (D2), governing wealth and resources, the Sun is in ${vargas.D2.Sun} and the Moon in ${vargas.D2.Moon}.
            </p>
            <p>
                In the Drekkana (D3), indicative of courage and siblings, the Ascendant falls in ${vargas.D3.Ascendant}.
                The Chaturthamsha (D4) shows the Ascendant in ${vargas.D4.Ascendant}, shedding light on destiny and property.
            </p>
            <p>
                The Saptamsha (D7), representing progeny and creative output, places the Ascendant in ${vargas.D7.Ascendant}.
                The Dashamsha (D10), vital for career and status, has the rising sign of ${vargas.D10.Ascendant}, 
                showing the karmic field of action.
            </p>
        </div>
    `;

    // Section 5: Yogas & Doshas
    if (yogas && yogas.length > 0) {
        narrative += `
            <div class="narrative-section">
                <h3 class="section-title">V. Yogas & Doshas</h3>
                <p>The following planetary combinations are present in the horoscope:</p>
                <ul>
        `;
        yogas.forEach(y => {
            narrative += `<li><strong>${y.name}</strong>: ${y.desc}</li>`;
        });
        narrative += `</ul></div>`;
    } else {
        narrative += `
            <div class="narrative-section">
                <h3 class="section-title">V. Yogas & Doshas</h3>
                <p>No major classical Yogas or Doshas (such as Pancha Mahapurusha or Kemadruma) are prominently detected in this standard scan, suggesting a balanced distribution of karma.</p>
            </div>
        `;
    }

    // Section 6: Ashtakavarga
    narrative += `
        <div class="narrative-section">
            <h3 class="section-title">VI. Ashtakavarga Strength</h3>
            <p>
                In the Sarvashtakavarga summation, we observe the distribution of strength across the zodiac.
                Notable strengths are found in the signs of:
            </p>
            <ul>
    `;

    let strongSigns = [];
    av.sarva.forEach((pts, i) => {
        if (pts >= 30) strongSigns.push({ sign: getZodiacName(i), pts });
    });

    if (strongSigns.length > 0) {
        strongSigns.forEach(s => {
            narrative += `<li><strong>${s.sign}</strong> with ${s.pts} points, indicating a fortified area of life.</li>`;
        });
    } else {
        narrative += `<li>The distribution of strength is moderate throughout the chart, with no sign exceeding 30 points excessively.</li>`;
    }

    narrative += `</ul></div>`;

    // Section 7: Vimshottari Dasha
    narrative += `
        <div class="narrative-section">
            <h3 class="section-title">VII. Vimshottari Dasha Cycles</h3>
            <p>
                The unfolding of karma occurs through the Dasha system. 
                The native was born during the Mahadasha of <strong>${dashas[0].lord}</strong>, 
                with a balance of ${(dashas[0].duration).toFixed(1)} years remaining at birth.
            </p>
            <p>The subsequent major periods (Mahadashas) are:</p>
            <ul>
    `;

    dashas.slice(1).forEach(d => {
        narrative += `<li><strong>${d.lord} Mahadasha</strong>: From ${d.start} to ${d.end}.</li>`;
    });

    narrative += `</ul></div>`;

    return narrative;
}

// Helpers
function formatOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getZodiacName(i) {
    const ZODIAC = [
        "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
        "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
    ];
    return ZODIAC[i];
}
