
const API_URL = 'http://localhost:5000/api';
const ADMIN_URL = 'http://localhost:5000/api/admin';

let map = null;
let allStations = [];
let routePoints = [];
let routeLayer = null;
let markerLayers = [];
let roadLayers = [];
let routePointMarkers = [];
let baseStations = [];
let adminMode = false;
let currentUser = null;

const ROUTE_COLOR = '#e74c3c';
const ROUTE_WEIGHT = 5;


function toggleAuthMode() {
    const isRegister = document.getElementById('isRegister').checked;
    document.getElementById('registerFields').style.display = isRegister ? 'block' : 'none';
    document.getElementById('authBtn').textContent = isRegister ? 'Зарегистрироваться' : 'Войти';
}

async function handleAuth(e) {
    e.preventDefault();

    const login = document.getElementById('authLogin').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    const isRegister = document.getElementById('isRegister').checked;
    const name = document.getElementById('authName').value.trim();
    const email = document.getElementById('authEmail').value.trim();

    const errorEl = document.getElementById('authError');
    errorEl.textContent = '';

    try {
        let endpoint, body;

        if (isRegister) {
            endpoint = '/auth/register';
            body = { login, password, name, email };
        } else {
            endpoint = '/auth/login';
            body = { login, password };
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            errorEl.textContent = data.error || 'Ошибка авторизации';
            return;
        }

        if (data.success) {
            currentUser = data.user || { login, role: 'admin', name: name || login };
            showApp();
        } else {
            errorEl.textContent = data.error || 'Неизвестная ошибка';
        }
    } catch (err) {
        console.warn('Auth error, using demo mode:', err);
        currentUser = { login: login || 'admin', role: 'admin', name: name || 'Администратор' };
        showApp();
        showToast('Работа в демо-режиме (сервер не отвечает)');
    }
}

function showApp() {
    document.getElementById('authModal').style.display = 'none';
    document.getElementById('app').style.display = 'block';

    document.getElementById('userInfo').textContent =
        `${currentUser.name || currentUser.login} | Роль: ${currentUser.role === 'admin' ? 'Администратор' : 'Пользователь'}`;

    if (currentUser.role === 'admin') {
        document.getElementById('adminPanel').style.display = 'flex';
        document.getElementById('baseStationLegend').style.display = 'flex';
    } else {
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('baseStationLegend').style.display = 'none';
    }
    initMap();
    loadData();
}

function logout() {
    currentUser = null;
    document.getElementById('app').style.display = 'none';
    document.getElementById('authModal').style.display = 'flex';
    document.getElementById('authLogin').value = '';
    document.getElementById('authPassword').value = '';
    document.getElementById('authError').textContent = '';
}


function initMap() {
    if (map) {
        map.invalidateSize();
        return;
    }

    map = L.map('map').setView([56.3, 43.9], 6.5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
}


async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка сервера');
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showToast(`Ошибка: ${error.message}`);
        throw error;
    }
}

async function adminRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${ADMIN_URL}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка сервера');
        }

        return await response.json();
    } catch (error) {
        console.error('Admin API Error:', error);
        showToast(` Ошибка: ${error.message}`);
        throw error;
    }
}

async function loadData() {
    try {
        const stations = await apiRequest('/stations');
        allStations = stations;

        const roadsResponse = await fetch('railways.geojson');
        if (roadsResponse.ok) {
            const roadData = await roadsResponse.json();
            displayRoads(roadData);
        }
        if (currentUser && currentUser.role === 'admin') {
            try {
                const adminData = await adminRequest('/data');
                if (adminData) {
                    baseStations = Object.keys(adminData.flags || {});
                    loadWagonCircles(adminData.circles || []);
                }
            } catch (e) {
                console.warn('Could not load admin data:', e);
            }
        }

        document.getElementById('loading').style.display = 'none';
        displayStations();
        updateStats();
        showToast('Данные загружены! Кликни на станцию для добавления в маршрут');

    } catch (error) {
        console.error(' Ошибка:', error);
        document.getElementById('loading').style.display = 'none';
        document.getElementById('stats').innerHTML = `
            <strong style="color: red;"> Ошибка:</strong>
            <span style="color: #666; margin-left: 15px;">${error.message}</span>
            <br>
            <span style="color: #999; font-size: 12px;">
                Убедись, что Python сервер запущен (python server.py)
            </span>
            <br>
            <button onclick="location.reload()" style="margin-top:8px; padding:5px 15px; background:#1a1a2e; color:white; border:none; border-radius:3px; cursor:pointer;">
                 Попробовать снова
            </button>
        `;
    }
}


function displayRoads(roadData) {
    roadLayers.forEach(layer => map.removeLayer(layer));
    roadLayers = [];

    if (roadData.features) {
        roadData.features.forEach(feature => {
            if (feature.geometry && feature.geometry.type === 'LineString') {
                const coords = feature.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                const layer = L.polyline(coords, {
                    color: '#555',
                    weight: 2,
                    opacity: 0.7,
                    smoothFactor: 1
                }).addTo(map);
                roadLayers.push(layer);
            }
        });
    }
}

function displayStations() {
    markerLayers.forEach(layer => map.removeLayer(layer));
    markerLayers = [];

    allStations.forEach(station => {
        const isInRoute = routePoints.some(p => p.name === station.name);
        const isBase = baseStations.includes(station.name);

        let fillColor = '#e74c3c';
        let borderColor = '#c0392b';
        let radius = 6;

        if (isInRoute) {
            fillColor = '#f1c40f';
            borderColor = '#f39c12';
            radius = 8;
        } else if (isBase) {
            fillColor = '#9b59b6';
            borderColor = '#8e44ad';
            radius = 8;
        }

        const marker = L.circleMarker([station.lat, station.lon], {
            radius: radius,
            fillColor: fillColor,
            color: borderColor,
            weight: isInRoute || isBase ? 3 : 2,
            opacity: 1,
            fillOpacity: 0.9
        });

        const isBaseText = isBase ? '<span class="badge base-badge">Опорная</span>' : '';
        const baseBtn = (currentUser && currentUser.role === 'admin') ? `
            <button class="btn base-btn ${isBase ? 'active' : ''}" onclick="toggleBaseStation('${station.name}')">
                ${isBase ? ' Убрать опорную' : 'Сделать опорной'}
            </button>
        ` : '';

        const popupContent = `
            <div class="station-popup">
                <h3>${station.name}</h3>
                <span class="badge">${station.type || 'Станция'}</span>
                ${isBaseText}
                <hr>
                <div class="field"><strong> Город:</strong> ${station.city || 'Не указан'}</div>
                <div class="field"><strong> Филиал:</strong> ${station.branch || 'Горьковская ЖД'}</div>
                <hr>
                <button class="btn route-btn" onclick="addToRoute('${station.name}')">
                    + Добавить в маршрут
                </button>
                ${baseBtn}
            </div>
        `;

        marker.bindPopup(popupContent);
        marker.addTo(map);
        markerLayers.push(marker);
    });
}

function addToRoute(stationName) {
    const station = allStations.find(s => s.name === stationName);
    if (!station) return;

    if (routePoints.some(p => p.name === stationName)) {
        showToast(` "${stationName}" уже в маршруте`);
        return;
    }

    routePoints.push(station);
    updateRouteStatus();
    displayStations();
    showToast(` Добавлена станция "${stationName}" (${routePoints.length})`);
}

async function buildRoute() {
    if (routePoints.length < 2) {
        showToast(' Добавьте минимум 2 станции в маршрут!');
        return;
    }

    showToast(' Строим маршрут...');

    try {
        const data = await apiRequest('/route', {
            method: 'POST',
            body: JSON.stringify({
                points: routePoints.map(p => ({
                    name: p.name,
                    lat: p.lat,
                    lon: p.lon
                }))
            })
        });

        if (routeLayer) {
            map.removeLayer(routeLayer);
            routeLayer = null;
        }
        routePointMarkers.forEach(m => map.removeLayer(m));
        routePointMarkers = [];

        const pathCoords = data.path.map(p => [p.lat, p.lon]);
        routeLayer = L.polyline(pathCoords, {
            color: ROUTE_COLOR,
            weight: ROUTE_WEIGHT,
            opacity: 0.9,
            smoothFactor: 1
        }).addTo(map);

        routePoints.forEach((point, idx) => {
            const marker = L.circleMarker([point.lat, point.lon], {
                radius: 10,
                fillColor: '#f1c40f',
                color: '#f39c12',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.9
            }).addTo(map).bindPopup(`
                <b>${idx + 1}. ${point.name}</b>
                <br>Точка маршрута
            `);
            routePointMarkers.push(marker);
        });

        const distance = data.distance;
        updateStatsWithRoute(distance, data);

        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
        showToast(`Маршрут построен! ${routePoints.length} станций, ${distance.route_km} км`);

    } catch (error) {
        console.error('Route error:', error);
    }
}

function clearRoute() {
    routePoints = [];
    if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }
    routePointMarkers.forEach(m => map.removeLayer(m));
    routePointMarkers = [];
    updateRouteStatus();
    displayStations();
    showToast('Маршрут очищен');
}


async function toggleBaseStation(stationName) {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('Только для администраторов');
        return;
    }

    const isBase = baseStations.includes(stationName);

    try {
        await adminRequest('/flags', {
            method: 'POST',
            body: JSON.stringify({
                stationName: stationName,
                isBase: !isBase
            })
        });

        if (isBase) {
            baseStations = baseStations.filter(s => s !== stationName);
            showToast(`Станция "${stationName}" больше не опорная`);
        } else {
            baseStations.push(stationName);
            showToast(`Станция "${stationName}" назначена опорной`);
        }

        displayStations();
    } catch (error) {
        console.error('Toggle base station error:', error);
    }
}


async function clearAdminData() {
    if (!confirm('Удалить все админ-данные (опорные станции и кружки)?')) return;

    try {

        const adminData = await adminRequest('/data');

        for (const station of baseStations) {
            await adminRequest('/flags', {
                method: 'POST',
                body: JSON.stringify({ stationName: station, isBase: false })
            });
        }

        baseStations = [];
        loadWagonCircles([]);
        displayStations();
        showToast('Все админ-данные очищены');
    } catch (error) {
        console.error('Clear admin data error:', error);
    }
}


function toggleAdminMode() {
    adminMode = !adminMode;
    const btn = document.querySelector('.admin-toggle');
    btn.textContent = adminMode ? 'Режим администратора (вкл)' : 'Режим администратора (выкл)';
    btn.classList.toggle('active');

    const status = document.getElementById('adminStatus');
    if (adminMode) {
        status.textContent = ' Режим редактирования активен: кликните на карту для добавления кружка';
        status.style.color = '#2ecc71';
    } else {
        status.textContent = ' Режим редактирования отключен';
        status.style.color = '#95a5a6';
    }
}


async function searchStations(query) {
    if (query.length < 1) {
        displayStations();
        return;
    }

    try {
        const encodedQuery = encodeURIComponent(query);
        const response = await fetch(`${API_URL}/stations/search?q=${encodedQuery}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const results = await response.json();

        if (!results || results.length === 0) {
            displayStations();
            return;
        }

        markerLayers.forEach(layer => map.removeLayer(layer));
        markerLayers = [];

        results.forEach(station => {
            const isInRoute = routePoints.some(p => p.name === station.name);
            const isBase = baseStations.includes(station.name);

            let fillColor = '#f1c40f';
            let borderColor = '#f39c12';

            if (isBase) {
                fillColor = '#9b59b6';
                borderColor = '#8e44ad';
            }

            const marker = L.circleMarker([station.lat, station.lon], {
                radius: 8,
                fillColor: fillColor,
                color: borderColor,
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
            });

            const isBaseText = isBase ? '<span class="badge base-badge">⭐ Опорная</span>' : '';

            marker.bindPopup(`
                <div class="station-popup">
                    <h3>${station.name}</h3>
                    ${isBaseText}
                    <hr>
                    <div class="field"><strong> Город:</strong> ${station.city || 'Не указан'}</div>
                    <hr>
                    <button class="btn route-btn" onclick="addToRoute('${station.name}')">
                        + Добавить в маршрут
                    </button>
                </div>
            `);

            marker.addTo(map);
            markerLayers.push(marker);
        });

    } catch (error) {
        console.error('Search error:', error);
        displayStations();
        showToast(' Ошибка поиска, показаны все станции');
    }
}

function updateStats() {
    document.getElementById('stats').innerHTML = `
        <span>
            <strong style="color: #2e7d32;"> Загружено:</strong>
            <span class="count">${allStations.length}</span> станций
            <span style="color: #666; margin-left: 20px;">|</span>
            <span style="color: #666; margin-left: 20px;"> Филиал: Горьковская ЖД</span>
            ${baseStations.length > 0 ? `<span style="color: #9b59b6; margin-left: 20px;"> Опорных: ${baseStations.length}</span>` : ''}
        </span>
        <span id="routeStatus">Маршрут: <span style="color:#2980b9; font-weight:bold;">выберите станции</span></span>
    `;
}

function updateRouteStatus() {
    const statusEl = document.getElementById('routeStatus');
    if (routePoints.length === 0) {
        updateStats();
        return;
    }

    const names = routePoints.map((p, i) =>
        `<span style="background:#2980b9; color:white; padding:2px 8px; border-radius:10px; margin:0 3px; font-size:11px;">${i+1}</span> ${p.name}`
    ).join(' → ');

    document.getElementById('routeStatus').innerHTML = `Маршрут: <span style="color:#2980b9; font-weight:bold;">${names}</span>`;
}

function updateStatsWithRoute(distance, routeData) {
    let distanceHtml = '';

    if (distance && distance.route_km) {
        let segmentsHtml = '';
        if (distance.segments && distance.segments.length > 0) {
            segmentsHtml = distance.segments.map((seg, i) =>
                `<span style="font-size:12px; color:#666;">
                    ${i+1}. ${seg.from} → ${seg.to}: <strong>${seg.distance_km} км</strong>
                </span>`
            ).join('<br>');
        }

        distanceHtml = `
            <div style="background:#e8f4f8; padding:8px 12px; border-radius:5px; margin:5px 0;">
                <strong>📏 Общая длина маршрута: <span style="color:#e74c3c; font-size:16px;">${distance.route_km} км</span></strong>
                <div style="margin-top:5px; font-size:12px;">
                    <details>
                        <summary style="cursor:pointer; color:#2980b9;">Детали маршрута</summary>
                        <div style="margin-top:5px; padding:5px; background:white; border-radius:3px;">
                            <strong>По железной дороге:</strong><br>
                            ${segmentsHtml || '—'}
                        </div>
                    </details>
                </div>
            </div>
        `;
    }

    const names = routePoints.map((p, i) =>
        `<span style="background:#2980b9; color:white; padding:2px 8px; border-radius:10px; margin:0 3px; font-size:11px;">${i+1}</span> ${p.name}`
    ).join(' → ');

    document.getElementById('stats').innerHTML = `
        <span>
            <strong style="color: #2e7d32;"> Загружено:</strong>
            <span class="count">${allStations.length}</span> станций
            <span style="color: #666; margin-left: 20px;">|</span>
            <span style="color: #666; margin-left: 20px;"> Филиал: Горьковская ЖД</span>
            ${baseStations.length > 0 ? `<span style="color: #9b59b6; margin-left: 20px;"> Опорных: ${baseStations.length}</span>` : ''}
        </span>
        <span>
            <span id="routeStatus">Маршрут: <span style="color:#2980b9; font-weight:bold;">${names}</span></span>
            ${distanceHtml}
        </span>
    `;
}


function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}


document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('authModal').style.display = 'flex';
});