// UI ЭЛЕМЕНТЫ
export function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

export function updateStats(stationsCount, baseCount) {
    document.getElementById('stats').innerHTML = `
        <span>
            <strong style="color: #2e7d32;"> Загружено:</strong>
            <span class="count">${stationsCount}</span> станций
            <span style="color: #666; margin-left: 20px;">|</span>
            ${baseCount > 0 ? `<span style="color: #9b59b6; margin-left: 20px;"> Опорных: ${baseCount}</span>` : ''}
        </span>
        <span id="routeStatus"> Маршрут: <span style="color:#2980b9; font-weight:bold;">выберите станции</span></span>
    `;
}

export function updateRouteStatus(routePoints) {
    const statusEl = document.getElementById('routeStatus');
    if (routePoints.length === 0) {
        return;
    }

    const names = routePoints.map((p, i) =>
        `<span style="background:#2980b9; color:white; padding:2px 8px; border-radius:10px; margin:0 3px; font-size:11px;">${i+1}</span> ${p.name}`
    ).join(' → ');

    document.getElementById('routeStatus').innerHTML = `Маршрут: <span style="color:#2980b9; font-weight:bold;">${names}</span>`;
}

export function updateStatsWithRoute(stationsCount, baseCount, routePoints, distance) {
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
                <strong>Общая длина маршрута: <span style="color:#e74c3c; font-size:16px;">${distance.route_km} км</span></strong>
                <div style="margin-top:5px; font-size:12px;">
                    <details>
                        <summary style="cursor:pointer; color:#2980b9;"> Детали маршрута</summary>
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
            <span class="count">${stationsCount}</span> станций
            <span style="color: #666; margin-left: 20px;">|</span>

            ${baseCount > 0 ? `<span style="color: #9b59b6; margin-left: 20px;"> Опорных: ${baseCount}</span>` : ''}
        </span>
        <span>
            <span id="routeStatus"> Маршрут: <span style="color:#2980b9; font-weight:bold;">${names}</span></span>
            ${distanceHtml}
        </span>
    `;
}
// Добавляем функцию для сохранения изменений в предприятиях
export async function saveEnterpriseData(stationName, data) {
    try {
        const response = await fetch(`http://localhost:5000/api/enterprises/${stationName}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (result.success) {
            showToast(`Данные для "${stationName}" обновлены`);
            return result.data;
        } else {
            showToast(`Ошибка: ${result.error}`);
            return null;
        }
    } catch (error) {
        console.error('Error saving enterprise data:', error);
        showToast('Ошибка при сохранении данных');
        return null;
    }
}

// Функция для обновления вагонов на станции
export async function updateStationWagons(stationName, type, count) {
    try {
        const response = await fetch(`http://localhost:5000/api/enterprises/${stationName}/wagons`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, count })
        });

        const result = await response.json();
        if (result.success) {
            showToast(`Вагоны обновлены: ${type} = ${count}`);
            return result.wagons;
        } else {
            showToast(`Ошибка: ${result.error}`);
            return null;
        }
    } catch (error) {
        console.error('Error updating wagons:', error);
        showToast('Ошибка при обновлении вагонов');
        return null;
    }
}
export function showAppUI(user) {
    // Показываем UI для авторизованного пользователя
}

export function hideAppUI() {
    // Скрываем UI
}