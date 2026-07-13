
import { handleAuth, toggleAuthMode, logout, currentUser } from './auth.js';
import {
    initMap, loadData, searchStations, buildRoute, clearRoute,
    addToRoute, toggleBaseStation, clearAdminData,
    openForestScenario, closeForestScenario, closeForestSelector,
    switchForestTab, openEnterpriseModal, closeEnterpriseModal,
    updateWagons, makeBaseWithWagons
} from './map.js';
import { showToast, updateStats, updateRouteStatus } from './ui.js';
import { API_URL, ADMIN_URL } from './config.js';


window.handleAuth = handleAuth;
window.toggleAuthMode = toggleAuthMode;
window.logout = logout;
window.searchStations = searchStations;
window.addToRoute = addToRoute;
window.toggleBaseStation = toggleBaseStation;
window.buildRoute = buildRoute;
window.clearRoute = clearRoute;
window.clearAdminData = clearAdminData;
window.openForestScenario = openForestScenario;
window.closeForestScenario = closeForestScenario;
window.closeForestSelector = closeForestSelector;
window.switchForestTab = switchForestTab;
window.openEnterpriseModal = openEnterpriseModal;
window.closeEnterpriseModal = closeEnterpriseModal;
window.updateWagons = updateWagons;
window.makeBaseWithWagons = makeBaseWithWagons;


document.addEventListener('DOMContentLoaded', function() {

    const authModal = document.getElementById('authModal');
    if (authModal) {
        authModal.style.display = 'flex';
    } else {
        console.error('Модальное окно авторизации не найдено!');
    }
});

export { currentUser };