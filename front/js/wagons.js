import { showToast } from './ui.js';
import { displayStations } from './map.js';

// ==================== ПЕРЕМЕННЫЕ ====================
window.wagonsData = {};

// ==================== ЗАГРУЗКА ДАННЫХ ====================
export async function loadWagonsData() {
    try {
        const response = await fetch('http://localhost:5000/api/admin/wagons/all');
        if (response.ok) {
            window.wagonsData = await response.json();
        }
    } catch (error) {
        console.error('Error loading wagons data:', error);
    }
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
export function initWagons() {
    console.log('🚂 Инициализация модуля вагонов...');

    // Загружаем данные о вагонах
    loadWagonsData();

    // Добавляем кнопку "Показать график" в админ-панель
    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel) {
        if (!document.querySelector('.forecast-btn')) {
            const forecastBtn = document.createElement('button');
            forecastBtn.className = 'forecast-btn';
            forecastBtn.innerHTML = '📊 Показать график вагонов';
            forecastBtn.onclick = showWagonsChart;
            forecastBtn.style.cssText = 'padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin: 0 5px;';
            adminPanel.appendChild(forecastBtn);
        }
    }

    // Создаем контейнер для графика
    if (!document.getElementById('wagonsChart')) {
        const chartContainer = document.createElement('div');
        chartContainer.id = 'wagonsChart';
        chartContainer.style.cssText = 'display: none; margin: 10px 20px; width: calc(100% - 40px); min-height: 350px; background: white; border-radius: 8px; padding: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);';

        const stats = document.getElementById('stats');
        if (stats && stats.parentNode) {
            stats.parentNode.insertBefore(chartContainer, stats.nextSibling);
        }
    }

    console.log('✅ Модуль вагонов инициализирован');
}

// ==================== ПОКАЗАТЬ ГРАФИК ====================
async function showWagonsChart() {
    const chartContainer = document.getElementById('wagonsChart');
    if (!chartContainer) return;

    // Загружаем свежие данные
    await loadWagonsData();
    const data = window.wagonsData;

    chartContainer.style.display = 'block';
    chartContainer.innerHTML = '';

    const stationNames = Object.keys(data);
    if (stationNames.length === 0) {
        chartContainer.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">Нет данных для отображения</p>';
        return;
    }

    // Проверяем D3
    if (typeof d3 === 'undefined') {
        chartContainer.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">⚠️ Библиотека D3 не загружена</p>';
        return;
    }

    // Собираем все даты
    let allDates = new Set();
    stationNames.forEach(name => {
        if (data[name] && data[name].wagons_history) {
            data[name].wagons_history.forEach(entry => {
                allDates.add(entry.date);
            });
        }
    });

    const sortedDates = Array.from(allDates).sort();

    if (sortedDates.length === 0) {
        chartContainer.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">Нет исторических данных</p>';
        return;
    }

    // Создаем график
    const containerWidth = chartContainer.clientWidth || 800;
    const margin = { top: 40, right: 80, bottom: 60, left: 60 };
    const width = Math.max(containerWidth - margin.left - margin.right, 400);
    const height = 350;

    const svg = d3.select(chartContainer)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scalePoint()
        .domain(sortedDates)
        .range([0, width])
        .padding(0.5);

    let maxCount = 10;
    stationNames.forEach(name => {
        if (data[name] && data[name].wagons_history) {
            data[name].wagons_history.forEach(entry => {
                if (entry.count > maxCount) maxCount = entry.count;
            });
        }
    });
    maxCount = Math.ceil(maxCount / 10) * 10 + 10;

    const yScale = d3.scaleLinear()
        .domain([0, maxCount])
        .range([height, 0]);

    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];

    stationNames.forEach((name, index) => {
        const color = colors[index % colors.length];
        const history = data[name].wagons_history || [];

        if (history.length < 2) return;

        history.sort((a, b) => a.date.localeCompare(b.date));

        const lineData = history.map(entry => ({
            date: entry.date,
            count: entry.count
        }));

        const line = d3.line()
            .x(d => xScale(d.date))
            .y(d => yScale(d.count))
            .curve(d3.curveMonotoneX);

        svg.append('path')
            .datum(lineData)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', 2.5)
            .attr('d', line);

        svg.selectAll(`.dot-${index}`)
            .data(lineData)
            .enter()
            .append('circle')
            .attr('cx', d => xScale(d.date))
            .attr('cy', d => yScale(d.count))
            .attr('r', 5)
            .attr('fill', color)
            .on('mouseover', function(event, d) {
                d3.select(this).attr('r', 8);
                showToast(`${name}: ${d.date} - ${d.count} вагонов`);
            })
            .on('mouseout', function() {
                d3.select(this).attr('r', 5);
            });

        if (lineData.length > 0) {
            const last = lineData[lineData.length - 1];
            svg.append('text')
                .attr('x', xScale(last.date) + 8)
                .attr('y', yScale(last.count) - 8)
                .attr('fill', color)
                .attr('font-size', '11px')
                .attr('font-weight', 'bold')
                .text(`${last.count}`);
        }
    });

    const xAxis = d3.axisBottom(xScale)
        .tickValues(sortedDates.filter((d, i) => i % Math.ceil(sortedDates.length / 10) === 0 || i === sortedDates.length - 1))
        .tickFormat(d => d.slice(5));

    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(xAxis)
        .style('font-size', '11px');

    svg.append('g')
        .call(d3.axisLeft(yScale).ticks(8))
        .style('font-size', '11px');

    const legend = svg.append('g')
        .attr('transform', `translate(${width - 160}, 10)`);

    stationNames.forEach((name, index) => {
        const color = colors[index % colors.length];
        const yPos = index * 22;

        legend.append('rect')
            .attr('x', 0)
            .attr('y', yPos)
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', color);

        legend.append('text')
            .attr('x', 18)
            .attr('y', yPos + 10)
            .style('font-size', '11px')
            .text(name);
    });

    showToast('📊 График загружен');
}