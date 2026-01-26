function isValidCanadianPostalCode(postalCode) {
    const regex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
    return regex.test(postalCode);
}
function formatPostalCode(postalCode) {
    const cleaned = postalCode.replace(/\s+/g, '').toUpperCase();
    if (cleaned.length === 6) {
        return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    }
    return cleaned;
}
async function predictSnowDay(postalCode) {
    const loading = document.getElementById('loading');
    const result = document.getElementById('result');
    loading.classList.remove('hidden');
    result.classList.add('hidden');
    try {
        const apiKey = '10653655a8664a44895123104261901';
        const response = await fetch(
            `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(postalCode)}&days=2&aqi=no&alerts=no`
        );
        if (!response.ok) {
            throw new Error('Weather service unavailable');
        }
        const weatherData = await response.json();
        const data = convertWeatherAPIData(weatherData);
        const prediction = calculateSnowDayProbability(data);
        displayResults(prediction, data, postalCode);
    } catch (error) {
        displayError(error.message);
    } finally {
        loading.classList.add('hidden');
    }
}
function convertWeatherAPIData(weatherData) {
    const current = weatherData.current;
    const forecast = weatherData.forecast.forecastday;
    const hourlyData = {
        time: [],
        snowfall: [],
        temperature_2m: [],
        wind_speed_10m: []
    };
    forecast.forEach(day => {
        day.hour.forEach(hour => {
            hourlyData.time.push(hour.time);
            hourlyData.snowfall.push(hour.snow_cm || 0);
            hourlyData.temperature_2m.push(hour.temp_c);
            hourlyData.wind_speed_10m.push(hour.wind_kph);
        });
    });
    const totalSnow = forecast.reduce((sum, day) => sum + (day.day.totalsnow_cm || 0), 0);
    const totalPrecip = forecast.reduce((sum, day) => sum + (day.day.totalprecip_mm || 0), 0);
    const minTemp = Math.min(...forecast.map(day => day.day.mintemp_c));
    return {
        current: {
            temperature_2m: current.temp_c,
            snowfall: current.precip_mm || 0,
            wind_speed_10m: current.wind_kph,
            precipitation: current.precip_mm || 0
        },
        hourly: hourlyData,
        daily: {
            snowfall_sum: [totalSnow],
            precipitation_sum: [totalPrecip],
            temperature_2m_min: [minTemp]
        },
        location: weatherData.location
    };
}
function getCoordinatesFromPostalCode(postalCode) {
    const firstChar = postalCode.charAt(0).toUpperCase();
    const fsaMap = {
        'M': { lat: 43.65, lon: -79.38, city: 'Toronto' },      // Toronto
        'K': { lat: 45.42, lon: -75.69, city: 'Ottawa' },       // Ottawa
        'H': { lat: 45.50, lon: -73.57, city: 'Montreal' },     // Montreal
        'V': { lat: 49.28, lon: -123.12, city: 'Vancouver' },   // Vancouver
        'T': { lat: 51.05, lon: -114.07, city: 'Calgary' },     // Calgary
        'E': { lat: 45.96, lon: -66.64, city: 'Fredericton' },  // New Brunswick
        'B': { lat: 44.65, lon: -63.57, city: 'Halifax' },      // Nova Scotia
        'C': { lat: 46.24, lon: -63.13, city: 'Charlottetown' },// PEI
        'A': { lat: 47.56, lon: -52.71, city: 'St. Johns' },    // Newfoundland
        'S': { lat: 52.13, lon: -106.67, city: 'Saskatoon' },   // Saskatchewan
        'R': { lat: 49.90, lon: -97.14, city: 'Winnipeg' },     // Manitoba
        'G': { lat: 46.81, lon: -71.21, city: 'Quebec City' },  // Quebec
        'J': { lat: 45.40, lon: -71.89, city: 'Sherbrooke' },   // Quebec
        'L': { lat: 43.45, lon: -80.49, city: 'Waterloo' },     // Ontario
        'N': { lat: 43.26, lon: -81.25, city: 'London' },       // Ontario
        'P': { lat: 46.49, lon: -84.34, city: 'Sault Ste Marie' }, // Ontario
        'X': { lat: 62.45, lon: -114.37, city: 'Yellowknife' }, // Northwest Territories
        'Y': { lat: 60.72, lon: -135.05, city: 'Whitehorse' },  // Yukon
    };
    return fsaMap[firstChar] || null;
}
function calculateSnowDayProbability(data) {
    const current = data.current;
    const daily = data.daily;
    const hourly = data.hourly;
    let probability = 0;
    let reasons = [];
    const now = new Date();
    const currentHour = now.getHours();
    let totalSnowfall24h = 0;
    let overnightSnowfall = 0;
    let maxWindSpeed = current.wind_speed_10m;
    let minTemp = current.temperature_2m;
    for (let i = 0; i < Math.min(24, hourly.time.length); i++) {
        if (hourly.snowfall && hourly.snowfall[i]) {
            totalSnowfall24h += hourly.snowfall[i];
            const forecastTime = new Date(hourly.time[i]);
            const hour = forecastTime.getHours();
            if (hour >= 20 || hour <= 8) {
                overnightSnowfall += hourly.snowfall[i];
            }
        }
        if (hourly.wind_speed_10m && hourly.wind_speed_10m[i] > maxWindSpeed) {
            maxWindSpeed = hourly.wind_speed_10m[i];
        }
        if (hourly.temperature_2m && hourly.temperature_2m[i] < minTemp) {
            minTemp = hourly.temperature_2m[i];
        }
    }
    if (current.snowfall > 0) {
        probability += 20;
        reasons.push('Currently snowing');
    }
    if (totalSnowfall24h >= 15) {
        probability += 50;
        reasons.push(`Heavy snow expected: ${totalSnowfall24h.toFixed(1)}cm total`);
    } else if (totalSnowfall24h >= 10) {
        probability += 40;
        reasons.push(`Significant snow expected: ${totalSnowfall24h.toFixed(1)}cm total`);
    } else if (totalSnowfall24h >= 5) {
        probability += 25;
        reasons.push(`Moderate snow expected: ${totalSnowfall24h.toFixed(1)}cm total`);
    } else if (totalSnowfall24h >= 2) {
        probability += 10;
        reasons.push(`Light snow expected: ${totalSnowfall24h.toFixed(1)}cm total`);
    }
    if (overnightSnowfall >= 10) {
        probability += 15;
        reasons.push(`Heavy overnight snow: ${overnightSnowfall.toFixed(1)}cm`);
    } else if (overnightSnowfall >= 5) {
        probability += 10;
        reasons.push(`Moderate overnight snow: ${overnightSnowfall.toFixed(1)}cm`);
    }
    if (maxWindSpeed > 50) {
        probability += 20;
        reasons.push('Blizzard conditions (50+ km/h winds)');
    } else if (maxWindSpeed > 40) {
        probability += 15;
        reasons.push('Very high winds (40+ km/h)');
    } else if (maxWindSpeed > 30) {
        probability += 8;
        reasons.push('High winds');
    }
    if (minTemp < -30) {
        probability += 20;
        reasons.push('Extreme cold warning territory');
    } else if (minTemp < -25) {
        probability += 12;
        reasons.push('Extreme cold conditions');
    } else if (minTemp < -20) {
        probability += 6;
        reasons.push('Very cold');
    }
    probability = Math.min(95, probability);
    let result = 'NO';
    let icon = '😢';
    let message = 'School is likely ON tomorrow';
    let className = 'snow-day-no';
    if (probability >= 65) {
        result = 'YES';
        icon = '🎉';
        message = 'HIGH chance of a SNOW DAY!';
        className = 'snow-day-yes';
    } else if (probability >= 40) {
        result = 'MAYBE';
        icon = '🤔';
        message = 'Possible snow day - monitor updates!';
        className = 'snow-day-maybe';
    }
    return {
        result,
        icon,
        message,
        className,
        probability,
        reasons,
        weather: {
            temperature: current.temperature_2m,
            snowfall: current.snowfall,
            windSpeed: current.wind_speed_10m,
            forecastedSnow: daily.snowfall_sum ? daily.snowfall_sum[0] : 0,
            total24hSnow: totalSnowfall24h,
            overnightSnow: overnightSnowfall,
            maxWindSpeed: maxWindSpeed,
            minTemp: minTemp
        }
    };
}
function displayResults(prediction, data, postalCode) {
    const resultDiv = document.getElementById('result');
    const resultContent = document.getElementById('resultContent');
    const cityName = data.location ? `${data.location.name}, ${data.location.region}` : getCoordinatesFromPostalCode(postalCode).city;
    resultContent.innerHTML = `
        <div class="result-icon">${prediction.icon}</div>
        <div class="result-title ${prediction.className}">${prediction.result}!</div>
        <div class="result-message">${prediction.message}</div>
        <div style="font-size: 1.5em; color: #764ba2; margin: 15px 0;">
            ${prediction.probability}% Probability
        </div>
        <div class="weather-details">
            <h3 style="margin-bottom: 15px;">Weather Forecast - ${cityName}</h3>
            <div class="weather-item">
                <span class="weather-label">Temperature:</span>
                <span class="weather-value">${prediction.weather.temperature.toFixed(1)}°C</span>
            </div>
            <div class="weather-item">
                <span class="weather-label">Current Snowfall:</span>
                <span class="weather-value">${prediction.weather.snowfall.toFixed(1)} cm</span>
            </div>
            <div class="weather-item">
                <span class="weather-label">Forecasted Snow:</span>
                <span class="weather-value">${prediction.weather.forecastedSnow.toFixed(1)} cm</span>
            </div>
            <div class="weather-item">
                <span class="weather-label">Wind Speed:</span>
                <span class="weather-value">${prediction.weather.windSpeed.toFixed(1)} km/h</span>
            </div>
        </div>
        ${prediction.reasons.length > 0 ? `
            <div style="margin-top: 20px; text-align: left;">
                <h4 style="margin-bottom: 10px;">Contributing Factors:</h4>
                <ul style="list-style-position: inside; color: #555;">
                    ${prediction.reasons.map(reason => `<li>${reason}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
    `;
    resultDiv.classList.remove('hidden');
    resultDiv.classList.add('show');
    renderHourlyChart(data);
    document.querySelector('.input-section').classList.add('hide');
    document.getElementById('backBtn').classList.remove('hidden');
    document.querySelector('.container').classList.add('has-results');
    setTimeout(() => {
        const voteSection = document.querySelector('.vote-section');
        voteSection.classList.remove('hidden');
        voteSection.classList.add('show');
        const voteCityElement = document.getElementById('voteCity');
        if (voteCityElement) {
            voteCityElement.textContent = cityName;
        }
        currentVoteLocation = cityName;
        updateVoteDisplay(currentVoteLocation);
    }, 600);
}
function renderHourlyChart(data) {
    const chartDiv = document.getElementById('hourlyChart');
    const chartPath = document.getElementById('chartPath');
    const chartXAxis = document.getElementById('chartXAxis');
    if (!data.hourly || !data.hourly.snowfall || !data.hourly.time) {
        return;
    }
    const maxHours = Math.min(8, data.hourly.time.length);
    const hourlyData = [];
    for (let i = 0; i < maxHours; i++) {
        const time = new Date(data.hourly.time[i]);
        const snowfall = data.hourly.snowfall[i] || 0;
        hourlyData.push({
            time: time,
            hour: time.getHours(),
            snowfall: snowfall // Keep in cm
        });
    }
    const width = 1200;
    const height = 180;
    const minScale = 1; // Start from 1cm on the chart
    const maxScale = 20; // Max at 20cm
    const actualMax = Math.max(...hourlyData.map(d => d.snowfall));
    const maxSnowfall = Math.max(maxScale, actualMax);
    let pathData = `M 0 ${height} `; // Start at bottom left
    hourlyData.forEach((point, index) => {
        const x = (index / Math.max(1, hourlyData.length - 1)) * width;
        const normalizedValue = Math.max(0, point.snowfall - minScale);
        const scaleRange = maxSnowfall - minScale;
        const y = height - (normalizedValue / scaleRange) * height;
        if (index === 0) {
            pathData += `L ${x} ${y} `;
        } else {
            const prevX = ((index - 1) / Math.max(1, hourlyData.length - 1)) * width;
            const prevNormalizedValue = Math.max(0, hourlyData[index - 1].snowfall - minScale);
            const prevY = height - (prevNormalizedValue / scaleRange) * height;
            const midX = (prevX + x) / 2;
            pathData += `Q ${prevX} ${prevY}, ${midX} ${(prevY + y) / 2} `;
            pathData += `Q ${x} ${y}, ${x} ${y} `;
        }
    });
    pathData += `L ${width} ${height} Z`; // Close path at bottom right
    chartPath.setAttribute('d', pathData);
    chartXAxis.innerHTML = '';
    const labelIndices = [0, 1, 2, 3, 4, 5, 6, 7];
    labelIndices.forEach(i => {
        if (i < hourlyData.length) {
            const label = document.createElement('div');
            label.className = 'x-label';
            const hour = hourlyData[i].hour;
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            label.textContent = `${displayHour}${ampm}`;
            chartXAxis.appendChild(label);
        }
    });
    chartDiv.classList.remove('hidden');
    chartDiv.classList.add('show');
}
function displayError(message) {
    const resultDiv = document.getElementById('result');
    const resultContent = document.getElementById('resultContent');
    resultContent.innerHTML = `
        <div class="result-icon">⚠️</div>
        <div class="result-title" style="color: #e74c3c;">Error</div>
        <div class="result-message">${message}</div>
        <p style="margin-top: 15px; color: #666;">Please check your postal code and try again.</p>
    `;
    resultDiv.classList.remove('hidden');
}
document.getElementById('predictBtn').addEventListener('click', () => {
    const postalCodeInput = document.getElementById('postalCode');
    const postalCode = formatPostalCode(postalCodeInput.value);
    if (!isValidCanadianPostalCode(postalCode)) {
        alert('Please enter a valid Canadian postal code (e.g., M5H 2N2)');
        return;
    }
    predictSnowDay(postalCode);
});
document.getElementById('postalCode').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('predictBtn').click();
    }
});
document.getElementById('postalCode').addEventListener('input', (e) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length > 3) {
        value = value.slice(0, 3) + ' ' + value.slice(3, 6);
    }
    e.target.value = value;
});
const BACKEND_URL = 'https://snowday-backend-production.up.railway.app';
async function getVotes(location) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/votes?location=${encodeURIComponent(location)}`);
        const data = await response.json();
        return data.votes || { yes: 0, no: 0 };
    } catch (error) {
        console.error('Error fetching votes:', error);
        return { yes: 0, no: 0 };
    }
}
async function submitVote(location, vote) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/vote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ location, vote })
        });
        const data = await response.json();
        return data.votes || { yes: 0, no: 0 };
    } catch (error) {
        console.error('Error submitting vote:', error);
        return null;
    }
}
async function changeVote(location, oldVote, newVote) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/vote/change`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ location, oldVote, newVote })
        });
        const data = await response.json();
        return data.votes || { yes: 0, no: 0 };
    } catch (error) {
        console.error('Error changing vote:', error);
        return null;
    }
}
function getUserVote(location) {
    const allUserVotes = localStorage.getItem('userVotes');
    if (allUserVotes) {
        const votesObj = JSON.parse(allUserVotes);
        return votesObj[location];
    }
    return null;
}
function saveUserVote(location, vote) {
    const allUserVotes = localStorage.getItem('userVotes');
    const votesObj = allUserVotes ? JSON.parse(allUserVotes) : {};
    votesObj[location] = vote;
    localStorage.setItem('userVotes', JSON.stringify(votesObj));
}
let currentVoteLocation = null;
function updateVoteDisplay(location) {
    if (!location) return;
    getVotes(location).then(votes => {
        const total = votes.yes + votes.no;
        console.log('Updating display for:', location, 'Votes:', votes);
        const yesPercent = total > 0 ? Math.round((votes.yes / total) * 100) : 0;
        const noPercent = total > 0 ? Math.round((votes.no / total) * 100) : 0;
        document.getElementById('yesBar').style.width = yesPercent + '%';
        document.getElementById('noBar').style.width = noPercent + '%';
        document.getElementById('yesPercent').textContent = yesPercent + '%';
        document.getElementById('noPercent').textContent = noPercent + '%';
        document.getElementById('totalVotes').textContent = total;
        console.log('Display updated - YES:', yesPercent + '%', 'NO:', noPercent + '%', 'Total:', total);
        const userVote = getUserVote(location);
        if (userVote === 'yes') {
            document.getElementById('voteYes').classList.add('selected');
            document.getElementById('voteNo').classList.remove('selected');
        } else if (userVote === 'no') {
            document.getElementById('voteNo').classList.add('selected');
            document.getElementById('voteYes').classList.remove('selected');
        } else {
            document.getElementById('voteYes').classList.remove('selected');
            document.getElementById('voteNo').classList.remove('selected');
        }
    });
}
const voteYesButton = document.getElementById('voteYes');
if (voteYesButton) {
    voteYesButton.addEventListener('click', function(e) {
        console.log('YES clicked');
        if (!currentVoteLocation) {
            console.log('No location set for voting');
            return;
        }
        const previousVote = getUserVote(currentVoteLocation);
        console.log('Voting YES for:', currentVoteLocation);
        console.log('Previous vote:', previousVote);
        if (previousVote === 'yes') {
            console.log('Already voted yes');
            return;
        }
        if (previousVote === 'no') {
            changeVote(currentVoteLocation, 'no', 'yes').then(votes => {
                if (votes) {
                    saveUserVote(currentVoteLocation, 'yes');
                    console.log('New votes:', votes);
                    updateVoteDisplay(currentVoteLocation);
                }
            }).catch(error => {
                console.error('Error voting:', error);
            });
        } else {
            submitVote(currentVoteLocation, 'yes').then(votes => {
                if (votes) {
                    saveUserVote(currentVoteLocation, 'yes');
                    console.log('New votes:', votes);
                    updateVoteDisplay(currentVoteLocation);
                }
            }).catch(error => {
                console.error('Error voting:', error);
            });
        }
    }, false);
}
const voteNoButton = document.getElementById('voteNo');
if (voteNoButton) {
    voteNoButton.addEventListener('click', function(e) {
        console.log('NO clicked');
        if (!currentVoteLocation) {
            console.log('No location set for voting');
            return;
        }
        const previousVote = getUserVote(currentVoteLocation);
        console.log('Voting NO for:', currentVoteLocation);
        console.log('Previous vote:', previousVote);
        if (previousVote === 'no') {
            console.log('Already voted no');
            return;
        }
        if (previousVote === 'yes') {
            changeVote(currentVoteLocation, 'yes', 'no').then(votes => {
                if (votes) {
                    saveUserVote(currentVoteLocation, 'no');
                    console.log('New votes:', votes);
                    updateVoteDisplay(currentVoteLocation);
                }
            }).catch(error => {
                console.error('Error voting:', error);
            });
        } else {
            submitVote(currentVoteLocation, 'no').then(votes => {
                if (votes) {
                    saveUserVote(currentVoteLocation, 'no');
                    console.log('New votes:', votes);
                    updateVoteDisplay(currentVoteLocation);
                }
            }).catch(error => {
                console.error('Error voting:', error);
            });
        }
    }, false);
}
document.getElementById('backBtn').addEventListener('click', () => {
    document.getElementById('result').classList.remove('show');
    document.getElementById('result').classList.add('hidden');
    document.getElementById('hourlyChart').classList.remove('show');
    document.getElementById('hourlyChart').classList.add('hidden');
    document.querySelector('.vote-section').classList.remove('show');
    document.querySelector('.vote-section').classList.add('hidden');
    document.querySelector('.input-section').classList.remove('hide');
    document.getElementById('backBtn').classList.add('hidden');
    document.querySelector('.container').classList.remove('has-results');
    document.getElementById('postalCode').value = '';
});
async function fetchAndDisplayStats() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/stats`);
        if (response.ok) {
            const stats = await response.json();
            document.getElementById('totalViews').textContent = stats.total_views || 0;
            document.getElementById('uniqueVisitors').textContent = stats.unique_visitors || 0;
        }
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

// Update stats on page load and every 30 seconds
fetchAndDisplayStats();
setInterval(fetchAndDisplayStats, 30000);