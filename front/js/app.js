// ==================== ГЛАВНЫЙ ФАЙЛ ПРИЛОЖЕНИЯ ====================
import { handleAuth, toggleAuthMode, logout, currentUser } from './auth.js';
import { initMap, loadData, searchStations, buildRoute, clearRoute, addToRoute, toggleBaseStation, clearAdminData } from './map.js';
import { showToast, updateStats, updateRouteStatus } from './ui.js';
import { API_URL, ADMIN_URL } from './config.js';

// Экспортируем функции для использования в HTML
window.handleAuth = handleAuth;
window.toggleAuthMode = toggleAuthMode;
window.logout = logout;
window.searchStations = searchStations;
window.buildRoute = buildRoute;
window.clearRoute = clearRoute;
window.addToRoute = addToRoute;
window.toggleBaseStation = toggleBaseStation;
window.clearAdminData = clearAdminData;

// ==================== ЗАПУСК ====================
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('authModal').style.display = 'flex';
    console.log('🚂 ЖД Навигатор загружен!');
    console.log(`📡 API сервер: ${API_URL}`);
    console.log(`🔧 Admin API: ${ADMIN_URL}`);
});

// Экспортируем для использования в других модулях
export { currentUser };