import { showToast } from './ui.js';
import { initMap, loadData } from './map.js';
import { showAppUI, hideAppUI } from './ui.js';

export let currentUser = null;

export function toggleAuthMode() {
    const isRegister = document.getElementById('isRegister').checked;
    document.getElementById('registerFields').style.display = isRegister ? 'block' : 'none';
    document.getElementById('authBtn').textContent = isRegister ? 'Зарегистрироваться' : 'Войти';
}

export async function handleAuth(e) {
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
        showToast('Работа в демо-режиме');
    }
}

export function showApp() {
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

    showAppUI(currentUser);
    initMap();
    loadData();
}

export function logout() {
    currentUser = null;
    document.getElementById('app').style.display = 'none';
    document.getElementById('authModal').style.display = 'flex';
    document.getElementById('authLogin').value = '';
    document.getElementById('authPassword').value = '';
    document.getElementById('authError').textContent = '';
    hideAppUI();
}