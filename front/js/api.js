import { API_URL, ADMIN_URL } from './config.js';
import { showToast } from './ui.js';

// ==================== API ЗАПРОСЫ ====================
export async function apiRequest(endpoint, options = {}) {
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
        showToast(`❌ Ошибка: ${error.message}`);
        throw error;
    }
}

export async function adminRequest(endpoint, options = {}) {
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
        showToast(`❌ Ошибка: ${error.message}`);
        throw error;
    }
}

export async function fetchStations() {
    return await apiRequest('/stations');
}

export async function searchStationsAPI(query) {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(`${API_URL}/stations/search?q=${encodedQuery}`);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
}

export async function buildRouteAPI(points) {
    return await apiRequest('/route', {
        method: 'POST',
        body: JSON.stringify({
            points: points.map(p => ({
                name: p.name,
                lat: p.lat,
                lon: p.lon
            }))
        })
    });
}

export async function toggleBaseStationAPI(stationName, isBase) {
    return await adminRequest('/flags', {
        method: 'POST',
        body: JSON.stringify({
            stationName: stationName,
            isBase: isBase
        })
    });
}

export async function getAdminDataAPI() {
    return await adminRequest('/data');
}