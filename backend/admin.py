import json
import os
from datetime import datetime, timedelta

ADMIN_DATA_FILE = '../front/data/admin_data.json'


def load_admin_data():
    """Загрузка административных данных"""
    if os.path.exists(ADMIN_DATA_FILE):
        try:
            with open(ADMIN_DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {'flags': {}, 'wagons_data': {}}
    return {'flags': {}, 'wagons_data': {}}


def save_admin_data(data):
    """Сохранение административных данных"""
    os.makedirs(os.path.dirname(ADMIN_DATA_FILE), exist_ok=True)
    with open(ADMIN_DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def set_station_flag(station_name, is_base=True):
    """Установка флага опорной станции"""
    admin_data = load_admin_data()

    if is_base:
        admin_data['flags'][station_name] = True
        if 'wagons_data' not in admin_data:
            admin_data['wagons_data'] = {}
        if station_name not in admin_data['wagons_data']:
            admin_data['wagons_data'][station_name] = []
    else:
        admin_data['flags'].pop(station_name, None)

    save_admin_data(admin_data)
    return admin_data['flags']


def add_wagons_data(station_name, count, date=None):
    """Добавление данных о вагонах для станции"""
    if date is None:
        date = datetime.now().strftime('%Y-%m-%d')

    admin_data = load_admin_data()

    # Проверяем, что станция опорная
    if station_name not in admin_data.get('flags', {}):
        return {'error': f'Станция "{station_name}" не является опорной'}

    if 'wagons_data' not in admin_data:
        admin_data['wagons_data'] = {}

    if station_name not in admin_data['wagons_data']:
        admin_data['wagons_data'][station_name] = []

    # Добавляем запись
    admin_data['wagons_data'][station_name].append({
        'date': date,
        'count': count
    })

    # Оставляем только последние 7 дней
    cutoff_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    admin_data['wagons_data'][station_name] = [
        entry for entry in admin_data['wagons_data'][station_name]
        if entry['date'] >= cutoff_date
    ]

    save_admin_data(admin_data)
    return admin_data['wagons_data'][station_name]


def get_station_wagons(station_name):
    """Получение истории вагонов для станции"""
    admin_data = load_admin_data()
    return admin_data.get('wagons_data', {}).get(station_name, [])


def get_current_wagons(station_name):
    """Получение текущего количества вагонов"""
    history = get_station_wagons(station_name)
    if not history:
        return 0
    # Сортируем по дате и берем последнее
    sorted_history = sorted(history, key=lambda x: x['date'])
    return sorted_history[-1]['count'] if sorted_history else 0


def get_all_base_stations_with_wagons():
    """Получение всех опорных станций с историей вагонов"""
    admin_data = load_admin_data()
    flags = admin_data.get('flags', {})
    wagons_data = admin_data.get('wagons_data', {})

    result = {}
    for station_name in flags.keys():
        if flags.get(station_name, False):
            history = wagons_data.get(station_name, [])
            current_count = get_current_wagons(station_name)
            result[station_name] = {
                'is_base': True,
                'wagons_history': history,
                'current_count': current_count
            }

    return result