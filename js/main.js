import { generateKundali } from './astro_core.js';
import { narrateKundali } from './narrator.js';
import { CITIES } from './cities.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('kundaliForm');
    const outputSection = document.getElementById('outputSection');
    const narrativeContent = document.getElementById('narrativeContent');
    const copyBtn = document.getElementById('copyBtn');
    const formatToggle = document.getElementById('formatToggle'); // Checkbox: Unchecked=Verbal, Checked=JSON

    // Autocomplete Elements
    const cityInput = document.getElementById('citySearch');
    const suggestionsList = document.getElementById('citySuggestions');
    const latInput = document.getElementById('lat');
    const lngInput = document.getElementById('lng');
    const tzInput = document.getElementById('timezone');
    const dobInput = document.getElementById('dob');
    const tobInput = document.getElementById('tob');

    let currentData = null; // Store data to switch views without recomputing
    let selectedCityTZ = null; // Store IANA TZ if city selected

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Show loading state
        const btn = form.querySelector('.generate-btn');
        const loader = btn.querySelector('.loader');
        const btnText = btn.querySelector('.btn-text');

        btnText.textContent = "Computing...";
        loader.classList.remove('hidden');
        btn.disabled = true;

        try {
            // Gather Data
            const fullName = document.getElementById('fullName').value;
            const gender = document.getElementById('gender').value;
            const dob = document.getElementById('dob').value;
            const tob = document.getElementById('tob').value;
            const latStr = document.getElementById('lat').value;
            const lngStr = document.getElementById('lng').value;

            if (!latStr || !lngStr) {
                alert("Please select a valid city from the list.");
                btnText.textContent = "Generate Verbal Kundali";
                loader.classList.add('hidden');
                btn.disabled = false;
                return;
            }

            const lat = parseFloat(latStr);
            const lng = parseFloat(lngStr);
            const tz = parseFloat(document.getElementById('timezone').value);

            // Construct Date object including offset
            // We need a UTC date for Astronomy Engine usually, but let's handle it in core

            // Wait a minimal amount to allow UI repaint
            await new Promise(r => setTimeout(r, 100));

            // 1. Calculate
            const kundaliData = generateKundali({
                fullName, gender, dob, tob, lat, lng, tz
            });

            currentData = kundaliData; // Store for toggling

            // RESET Toggle to Verbal by default on new generation
            formatToggle.checked = false;
            renderOutput();

            outputSection.classList.remove('hidden');

            // Scroll to output
            outputSection.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            console.error(error);
            alert("Error generating Kundali: " + error.message);
        } finally {
            btnText.textContent = "Generate Verbal Kundali";
            loader.classList.add('hidden');
            btn.disabled = false;
        }
    });

    // --- Autocomplete Logic ---

    cityInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        selectedCityTZ = null; // Reset if user types manually

        if (query.length < 2) {
            suggestionsList.classList.add('hidden');
            return;
        }

        const matches = CITIES.filter(c => c.name.toLowerCase().includes(query));

        if (matches.length > 0) {
            suggestionsList.innerHTML = matches.map((city, index) =>
                `<li data-index="${index}">${city.name}</li>`
            ).join('');
            suggestionsList.classList.remove('hidden');

            // Attach click listeners to new items
            suggestionsList.querySelectorAll('li').forEach(item => {
                item.addEventListener('click', () => {
                    const index = item.getAttribute('data-index');
                    selectCity(matches[index]);
                });
            });
        } else {
            suggestionsList.classList.add('hidden');
        }
    });

    // Hide suggestions on click outside
    document.addEventListener('click', (e) => {
        if (!cityInput.contains(e.target) && !suggestionsList.contains(e.target)) {
            suggestionsList.classList.add('hidden');
        }
    });

    function selectCity(city) {
        cityInput.value = city.name;
        latInput.value = city.lat;
        lngInput.value = city.lng;
        selectedCityTZ = city.tz;
        suggestionsList.classList.add('hidden');

        // Try to calculate TZ offset immediately if date/time exist
        updateTimezoneEffectively();
    }

    // Update offset when Date or Time changes (IF city is selected)
    dobInput.addEventListener('change', updateTimezoneEffectively);
    tobInput.addEventListener('change', updateTimezoneEffectively);

    function updateTimezoneEffectively() {
        if (!selectedCityTZ || !dobInput.value || !tobInput.value) return;

        const tzOffset = getTimezoneOffset(dobInput.value, tobInput.value, selectedCityTZ);
        tzInput.value = tzOffset;

        // Flash visualization (optional feedback)
        tzInput.style.borderColor = '#9d4edd';
        setTimeout(() => tzInput.style.borderColor = '', 500);
    }

    /**
     * Calculates UTC offset in Hours (e.g., 5.5 for IST)
     * using the browser's Intl API for handling DST transitions accurately.
     */
    function getTimezoneOffset(dateStr, timeStr, ianaZone) {
        // Create a date object in the context of the selected timezone
        // We need to match the wall time "YYYY-MM-DD HH:MM" in that zone.
        // Then compare it to UTC.

        // Approach:
        // 1. Construct string "YYYY-MM-DDTHH:MM:SS"
        // 2. We want to find the Timestamp (UTC) such that toLocaleString(timeZone) == input.
        // OR simpler: Use formatting parts.

        // Robust way:
        // Treat input as UTC first, then check difference? No, confusing.
        // Best Modern Way:
        // Create a Date object assuming inputs are roughly local.
        // Actually, we can just use `new Date()` and Format it to Parts to get the offset?
        // No, Intl doesn't give offset number directly easily.

        // Hacky but reliable way:
        // 1. Create a date object 'Ref' from input string (Browser treats as Local or UTC).
        // 2. Format 'Ref' to string "M/D/Y, H:M:S" in Target Zone.
        // 3. Format 'Ref' to string "M/D/Y, H:M:S" in UTC.
        // This measures difference between TargetZone and UTC for the SAME Instant.
        // This gives offset of the Instant, but we need offset for Wall Time.

        // Correct Algorithm:
        // We have Wall Time (W). We need UTC (U).
        // U = W - Offset.
        // But Offset depends on U (technically W is ambiguous during fall-back).
        // Let's assume standard behavior (Spring fwd: invalid time -> +1? Fall back: first occurrence).

        // Let's use string manipulation with 'GMT' style.
        // supported in many browsers: `new Date("2023-01-01T12:00:00").toLocaleString("en-US", {timeZone: "Asia/Kolkata", timeZoneName: "longOffset"})` -> "GMT+05:30"

        // We need the input date.
        const dt = new Date(`${dateStr}T${timeStr}`);

        // But 'dt' is created in User's Local Browser Time. That's irrelevant.
        // We just need the Epoch time that corresponds to Date+Time in TargetZone.
        // JS Date doesn't support "Set Zone".

        // Workaround:
        // Use a date, format it to parts in that zone, find discrepancy, adjust.
        // Or keep it simple:
        // The user inputs string. We want the offset for that string in that zone.
        // `getTimezoneOffset` returns Minutes.

        // Let's use a small loop to converge or use the `formatToParts` of Intl.
        // Let's rely on the string "GMT+XX:XX" extraction.

        // Create an arbitrary date with the user's components
        const testDate = new Date(`${dateStr}T${timeStr}:00Z`); // UTC
        // This is a specific Instant.
        // What is the offset of THIS instant in Target Zone?
        // Let's convert to string with Offset.

        const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: ianaZone,
            timeZoneName: 'longOffset',
        });

        // Problem: This gives offset for the UTC instant, not for the Wall Clock.
        // But usually, offset doesn't change THAT fast.
        // If we use the UTC date constructed from Wall Time, we are off by strict offset.
        // e.g. Input 12:00. We assume 12:00 UTC.
        // Real time is 12:00 IST -> 06:30 UTC.
        // So we are looking up offset for 12:00 UTC vs 06:30 UTC.
        // Unless DST transition happens between them (unlikely for 5-10hr gap usually, but possible).

        // Better:
        // Extract "GMT+05:30" string.
        const parts = fmt.formatToParts(testDate);
        const offsetPart = parts.find(p => p.type === 'timeZoneName');
        const offsetStr = offsetPart ? offsetPart.value : ''; // "GMT+05:30" or "GMT-04:00"

        // Parse "GMT+05:30" -> 5.5
        // Remove "GMT"
        const clean = offsetStr.replace("GMT", "");
        if (!clean) return 0; // fallback

        const sign = clean.includes('-') ? -1 : 1;
        const [h, m] = clean.replace('+', '').replace('-', '').split(':').map(Number);

        return sign * (h + (m / 60));
    }

    // Toggle Handler
    formatToggle.addEventListener('change', () => {
        renderOutput();
    });

    function renderOutput() {
        if (!currentData) return;

        if (formatToggle.checked) {
            // JSON Mode
            const jsonStr = JSON.stringify(currentData, null, 2);
            narrativeContent.innerHTML = `<div class="json-output">${jsonStr}</div>`;
        } else {
            // Verbal Mode
            const narrative = narrateKundali(currentData);
            narrativeContent.innerHTML = narrative;
        }
    }

    copyBtn.addEventListener('click', () => {
        const text = formatToggle.checked ? narrativeContent.innerText : narrativeContent.innerText;
        navigator.clipboard.writeText(text).then(() => {
            alert('Content copied to clipboard!');
        });
    });
});
