import { MAP_DEFAULTS, ROUTE_COLOR, ROUTE_WEIGHT } from './config.js';
import { apiRequest, fetchStations, searchStationsAPI, buildRouteAPI, getAdminDataAPI, toggleBaseStationAPI } from './api.js';
import { currentUser } from './auth.js';
import { updateStats, updateRouteStatus, updateStatsWithRoute, showToast } from './ui.js';

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let map = null;
export let allStations = [];
export let routePoints = [];
export let routeLayer = null;
export let markerLayers = [];
export let roadLayers = [];
export let routePointMarkers = [];
export let baseStations = [];
export let wagonsData = {}; // Храним данные о вагонах здесь

// ==================== КАРТА ====================
export function initMap() {
    if (map) {
        map.invalidateSize();
        return;
    }

    map = L.map('map').setView(MAP_DEFAULTS.center, MAP_DEFAULTS.zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: MAP_DEFAULTS.maxZoom
    }).addTo(map);

    return map;
}

export function getMap() {
    return map;
}

// ==================== ОТОБРАЖЕНИЕ ДОРОГ ====================
export function displayRoads(roadData) {
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

// ==================== ЗАГРУЗКА ДАННЫХ О ВАГОНАХ ====================
export async function loadWagonsData() {
    try {
        const response = await fetch('http://localhost:5000/api/admin/wagons/all');
        if (response.ok) {
            wagonsData = await response.json();
            console.log('✅ Данные о вагонах загружены:', wagonsData);
        }
    } catch (error) {
        console.error('Error loading wagons data:', error);
    }
}

// ==================== ЗАГРУЗКА ДАННЫХ ====================
export async function loadData() {
    try {
        const stations = await fetchStations();
        allStations = stations;

        // Загружаем железные дороги
        const roadsResponse = await fetch('data/railways.geojson');
        if (roadsResponse.ok) {
            const roadData = await roadsResponse.json();
            displayRoads(roadData);
        }

        // Загружаем данные о вагонах ДО отображения станций
        await loadWagonsData();

        if (currentUser && currentUser.role === 'admin') {
            try {
                const adminData = await getAdminDataAPI();
                if (adminData) {
                    baseStations = Object.keys(adminData.flags || {});
                }
            } catch (e) {
                console.warn('Could not load admin data:', e);
            }
        }

        document.getElementById('loading').style.display = 'none';
        displayStations();
        updateStats(allStations.length, baseStations.length);
        showToast('✅ Данные загружены! Кликните на станцию для добавления в маршрут');

    } catch (error) {
        console.error('❌ Ошибка:', error);
        document.getElementById('loading').style.display = 'none';
        document.getElementById('stats').innerHTML = `
            <strong style="color: red;">❌ Ошибка:</strong>
            <span style="color: #666; margin-left: 15px;">${error.message}</span>
            <br>
            <span style="color: #999; font-size: 12px;">
                Убедись, что Python сервер запущен (python server.py)
            </span>
            <br>
            <button onclick="location.reload()" style="margin-top:8px; padding:5px 15px; background:#1a1a2e; color:white; border:none; border-radius:3px; cursor:pointer;">
                🔄 Попробовать снова
            </button>
        `;
    }
}

// ==================== ОТОБРАЖЕНИЕ СТАНЦИЙ ====================
export function displayStations() {
    markerLayers.forEach(layer => map.removeLayer(layer));
    markerLayers = [];

    allStations.forEach(station => {
        const isInRoute = routePoints.some(p => p.name === station.name);
        const isBase = baseStations.includes(station.name);

        // Получаем текущее количество вагонов из wagonsData
        let currentWagons = 0;
        if (isBase && wagonsData[station.name]) {
            currentWagons = wagonsData[station.name].current_count || 0;
        }

        // Создаем иконку для маркера
        let icon;

        if (isBase) {
            // Для опорной станции - флажок с числом вагонов
            const wagonText = currentWagons > 0 ? `<div style="font-size: 10px; color: white; text-align: center; margin-top: 2px;">${currentWagons}</div>` : '';

            icon = L.divIcon({
                className: 'base-station-icon',
                html: `
                    <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
                        <!-- Флажок -->
                        <div style="position: relative; width: 32px; height: 32px;">
                            <!-- Древко флага -->
                            <div style="position: absolute; left: 14px; top: 0; width: 3px; height: 32px; background: #555; border-radius: 1px;"></div>
                            <!-- Полотнище флага -->
                            <div style="position: absolute; left: 14px; top: 2px; width: 24px; height: 18px; background: #e74c3c; clip-path: polygon(0 0, 100% 0, 100% 70%, 0 100%); border-radius: 2px 2px 0 0; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
                            </div>
                        </div>
                        <!-- Количество вагонов под флажком -->
                        <div style="background: #9b59b6; color: white; border-radius: 12px; padding: 1px 10px; font-size: 11px; font-weight: bold; margin-top: -4px; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.3); min-width: 20px; text-align: center;">
                            ${currentWagons}
                        </div>
                    </div>
                `,
                iconSize: [32, 50],
                iconAnchor: [16, 50],
                popupAnchor: [0, -45]
            });
        } else if (isInRoute) {
            // Точка маршрута - желтый кружок
            icon = L.divIcon({
                className: 'route-point-icon',
                html: `
                    <div style="width: 16px; height: 16px; background: #f1c40f; border-radius: 50%; border: 3px solid #f39c12; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>
                `,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
                popupAnchor: [0, -8]
            });
        } else {
            // Обычная станция - красный кружок
            icon = L.divIcon({
                className: 'station-icon',
                html: `
                    <div style="width: 12px; height: 12px; background: #e74c3c; border-radius: 50%; border: 2px solid #c0392b; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
                `,
                iconSize: [12, 12],
                iconAnchor: [6, 6],
                popupAnchor: [0, -6]
            });
        }

        const marker = L.marker([station.lat, station.lon], { icon: icon });

        // Строим попап
        let popupContent = '';

        if (currentUser && currentUser.role === 'admin') {
            if (isBase) {
                // Опорная станция - показываем поле для изменения вагонов
                popupContent = `
                    <div class="station-popup" style="min-width: 220px;">
                        <h3 style="margin: 0 0 5px 0;">${station.name}</h3>
                        <span class="badge" style="background: #9b59b6; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px;">⭐ Опорная</span>
                        <div style="margin: 8px 0; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 14px;">🚂 Вагонов:</span>
                            <span style="background: #9b59b6; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">
                                ${currentWagons}
                            </span>
                        </div>
                        <hr style="margin: 8px 0; border: none; border-top: 1px solid #eee;">
                        <div style="margin: 8px 0;">
                            <div style="display: flex; gap: 5px; align-items: center;">
                                <input type="number" id="wagons_input_${station.name.replace(/\s/g, '_')}"
                                       placeholder="Новое кол-во"
                                       style="flex: 1; padding: 5px 8px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px; width: 80px;">
                                <button onclick="window.updateWagons('${station.name}')"
                                        style="padding: 5px 12px; background: #2ecc71; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 13px;">
                                    Обновить
                                </button>
                            </div>
                        </div>
                        <button onclick="window.toggleBaseStation('${station.name}')"
                                style="padding: 6px 12px; background: #e74c3c; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 13px; width: 100%; margin-top: 5px;">
                            ✕ Убрать опорную
                        </button>
                        <hr style="margin: 8px 0; border: none; border-top: 1px solid #eee;">
                        <button class="btn route-btn" onclick="window.addToRoute('${station.name}')"
                                style="padding: 6px 12px; background: #2980b9; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 13px; width: 100%;">
                            ➕ Добавить в маршрут
                        </button>
                    </div>
                `;
            } else {
                // Не опорная - кнопка "Сделать опорной" с полем для вагонов
                popupContent = `
                    <div class="station-popup" style="min-width: 220px;">
                        <h3 style="margin: 0 0 5px 0;">${station.name}</h3>
                        <span class="badge" style="background: #3498db; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px;">${station.type || 'Станция'}</span>
                        <hr style="margin: 8px 0; border: none; border-top: 1px solid #eee;">
                        <div class="field" style="font-size: 13px; color: #555;"><strong>Город:</strong> ${station.city || 'Не указан'}</div>
                        <hr style="margin: 8px 0; border: none; border-top: 1px solid #eee;">
                        <div style="margin: 8px 0;">
                            <label style="font-size: 13px; font-weight: 600;">Количество вагонов:</label>
                            <input type="number" id="wagons_input_${station.name.replace(/\s/g, '_')}"
                                   placeholder="Введите кол-во"
                                   style="width: 100%; padding: 5px 8px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px; margin-top: 3px;">
                        </div>
                        <button onclick="window.makeBaseWithWagons('${station.name}')"
                                style="padding: 6px 12px; background: #9b59b6; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 13px; width: 100%;">
                             Сделать опорной
                        </button>
                        <hr style="margin: 8px 0; border: none; border-top: 1px solid #eee;">
                        <button class="btn route-btn" onclick="window.addToRoute('${station.name}')"
                                style="padding: 6px 12px; background: #2980b9; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 13px; width: 100%;">
                            + Добавить в маршрут
                        </button>
                    </div>
                `;
            }
        } else {
            // Обычный пользователь - только информация
            popupContent = `
                <div class="station-popup">
                    <h3 style="margin: 0 0 5px 0;">${station.name}</h3>
                    <span class="badge" style="background: #3498db; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px;">${station.type || 'Станция'}</span>
                    ${isBase ? `<div style="margin: 5px 0; color: #9b59b6;"> Опорная станция</div>` : ''}
                    <hr style="margin: 8px 0; border: none; border-top: 1px solid #eee;">
                    <div class="field" style="font-size: 13px; color: #555;"><strong> Город:</strong> ${station.city || 'Не указан'}</div>
                    <hr style="margin: 8px 0; border: none; border-top: 1px solid #eee;">
                    <button class="btn route-btn" onclick="window.addToRoute('${station.name}')"
                            style="padding: 6px 12px; background: #2980b9; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 13px; width: 100%;">
                        + Добавить в маршрут
                    </button>
                </div>
            `;
        }

        marker.bindPopup(popupContent);
        marker.addTo(map);
        markerLayers.push(marker);
    });
}
// ==================== НОВЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С ВАГОНАМИ ====================

// Функция для создания опорной станции с вагонами
window.makeBaseWithWagons = async function(stationName) {
    const inputId = `wagons_input_${stationName.replace(/\s/g, '_')}`;
    const input = document.getElementById(inputId);
    if (!input) {
        showToast('❌ Поле ввода не найдено');
        return;
    }

    const count = parseInt(input.value);
    if (!count || count <= 0) {
        showToast('⚠️ Введите количество вагонов (число > 0)');
        return;
    }

    try {
        // Сначала делаем станцию опорной
        const response = await fetch('http://localhost:5000/api/admin/flags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stationName: stationName,
                isBase: true
            })
        });

        const result = await response.json();

        if (result.success) {
            // Добавляем начальное количество вагонов
            const wagonsResponse = await fetch('http://localhost:5000/api/admin/wagons/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stationName: stationName,
                    count: count
                })
            });

            const wagonsResult = await wagonsResponse.json();

            if (wagonsResult.success) {
                // Обновляем локальные данные
                if (!baseStations.includes(stationName)) {
                    baseStations.push(stationName);
                }

                // Обновляем данные о вагонах
                await loadWagonsData();

                showToast(`✅ Станция "${stationName}" назначена опорной с ${count} вагонами`);

                // Закрываем попап и обновляем карту
                map.closePopup();
                displayStations();
            } else {
                showToast(`❌ Ошибка при добавлении вагонов: ${wagonsResult.error}`);
            }
        } else {
            showToast(`❌ Ошибка: ${result.error}`);
        }
    } catch (error) {
        console.error('Error making base station:', error);
        showToast('❌ Ошибка при назначении опорной станции');
    }
};

// Функция для обновления количества вагонов
window.updateWagons = async function(stationName) {
    const inputId = `wagons_input_${stationName.replace(/\s/g, '_')}`;
    const input = document.getElementById(inputId);
    if (!input) {
        showToast('❌ Поле ввода не найдено');
        return;
    }

    const count = parseInt(input.value);
    if (!count || count <= 0) {
        showToast('⚠️ Введите количество вагонов (число > 0)');
        return;
    }

    try {
        const response = await fetch('http://localhost:5000/api/admin/wagons/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stationName: stationName,
                count: count
            })
        });

        const result = await response.json();

        if (result.success) {
            showToast(`✅ Обновлено: ${count} вагонов для "${stationName}"`);
            input.value = '';

            // Обновляем данные о вагонах
            await loadWagonsData();

            // Закрываем попап и обновляем карту
            map.closePopup();
            displayStations();
        } else {
            showToast(`❌ Ошибка: ${result.error}`);
        }
    } catch (error) {
        console.error('Error updating wagons:', error);
        showToast('❌ Ошибка при обновлении вагонов');
    }
};

// ==================== МАРШРУТ ====================
export function addToRoute(stationName) {
    const station = allStations.find(s => s.name === stationName);
    if (!station) return;

    if (routePoints.some(p => p.name === stationName)) {
        showToast(`⚠️ "${stationName}" уже в маршруте`);
        return;
    }

    routePoints.push(station);
    updateRouteStatus(routePoints);
    displayStations(); // Перерисовываем, но данные о вагонах уже в wagonsData
    showToast(`✅ Добавлена станция "${stationName}" (${routePoints.length})`);
}

export async function buildRoute() {
    if (routePoints.length < 2) {
        showToast('⚠️ Добавьте минимум 2 станции в маршрут!');
        return;
    }

    showToast('🔄 Строим маршрут...');

    try {
        const data = await buildRouteAPI(routePoints);

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
                <br>📍 Точка маршрута
            `);
            routePointMarkers.push(marker);
        });

        const distance = data.distance;
        updateStatsWithRoute(allStations.length, baseStations.length, routePoints, distance);

        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
        showToast(`✅ Маршрут построен! ${routePoints.length} станций, ${distance.route_km} км`);

    } catch (error) {
        console.error('Route error:', error);
    }
}

export function clearRoute() {
    routePoints = [];
    if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }
    routePointMarkers.forEach(m => map.removeLayer(m));
    routePointMarkers = [];
    updateRouteStatus(routePoints);
    displayStations(); // Перерисовываем, данные о вагонах сохраняются
    showToast('🗑 Маршрут очищен');
}

// ==================== ОПОРНЫЕ СТАНЦИИ ====================
export async function toggleBaseStation(stationName) {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('⛔ Только для администраторов');
        return;
    }

    const isBase = baseStations.includes(stationName);

    try {
        await toggleBaseStationAPI(stationName, !isBase);

        if (isBase) {
            baseStations = baseStations.filter(s => s !== stationName);
            showToast(`❌ Станция "${stationName}" больше не опорная`);
        } else {
            baseStations.push(stationName);
            showToast(`⭐ Станция "${stationName}" назначена опорной`);
        }

        // Перезагружаем данные о вагонах после изменения опорных станций
        await loadWagonsData();
        displayStations();
    } catch (error) {
        console.error('Toggle base station error:', error);
    }
}

export async function clearAdminData() {
    if (!confirm('❓ Удалить все админ-данные (опорные станции)?')) return;

    try {
        for (const station of baseStations) {
            await toggleBaseStationAPI(station, false);
        }

        baseStations = [];
        await loadWagonsData(); // Обновляем данные
        displayStations();
        showToast('✅ Все админ-данные очищены');
    } catch (error) {
        console.error('Clear admin data error:', error);
    }
}

// ==================== ПОИСК ====================
export async function searchStations(query) {
    if (query.length < 1) {
        displayStations();
        return;
    }

    try {
        const results = await searchStationsAPI(query);

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
                    <div class="field"><strong>🏙 Город:</strong> ${station.city || 'Не указан'}</div>
                    <hr>
                    <button class="btn route-btn" onclick="window.addToRoute('${station.name}')">
                        ➕ Добавить в маршрут
                    </button>
                </div>
            `);

            marker.addTo(map);
            markerLayers.push(marker);
        });

    } catch (error) {
        console.error('Search error:', error);
        displayStations();
        showToast('❌ Ошибка поиска, показаны все станции');
    }
}

// Делаем функции глобальными для использования в HTML
window.addToRoute = addToRoute;
window.buildRoute = buildRoute;
window.clearRoute = clearRoute;
window.toggleBaseStation = toggleBaseStation;
window.clearAdminData = clearAdminData;
window.searchStations = searchStations;
window.updateWagons = updateWagons;
window.makeBaseWithWagons = makeBaseWithWagons;