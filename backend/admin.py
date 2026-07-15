import json
import os
from datetime import datetime, timedelta

ADMIN_DATA_FILE = '../front/data/admin_data.json'


def load_admin_data():
    """Загрузка административных данных"""
    if os.path.exists(ADMIN_DATA_FILE):
        try:
            with open(ADMIN_DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Добавляем поле attached_stations если его нет
                if 'attached_stations' not in data:
                    data['attached_stations'] = {}
                return data
        except:
            return {'flags': {}, 'wagons_data': {}, 'attached_stations': {}}
    return {'flags': {}, 'wagons_data': {}, 'attached_stations': {}}


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
        if 'attached_stations' not in admin_data:
            admin_data['attached_stations'] = {}
        if station_name not in admin_data['attached_stations']:
            admin_data['attached_stations'][station_name] = []
    else:
        admin_data['flags'].pop(station_name, None)
        admin_data['attached_stations'].pop(station_name, None)

    save_admin_data(admin_data)
    return admin_data['flags']


def attach_station_to_base(base_station, station_to_attach):
    """Прикрепление станции к опорной"""
    admin_data = load_admin_data()

    if base_station not in admin_data.get('flags', {}):
        return {'error': f'Станция "{base_station}" не является опорной'}

    if 'attached_stations' not in admin_data:
        admin_data['attached_stations'] = {}

    if base_station not in admin_data['attached_stations']:
        admin_data['attached_stations'][base_station] = []

    # Проверяем, не прикреплена ли уже станция к другой опорной
    for base, attached in admin_data['attached_stations'].items():
        if station_to_attach in attached:
            return {'error': f'Станция "{station_to_attach}" уже прикреплена к "{base}"'}

    if station_to_attach not in admin_data['attached_stations'][base_station]:
        admin_data['attached_stations'][base_station].append(station_to_attach)
        save_admin_data(admin_data)
        return {'success': True, 'attached': admin_data['attached_stations']}

    return {'success': False, 'message': 'Станция уже прикреплена'}


def detach_station_from_base(base_station, station_to_detach):
    """Открепление станции от опорной"""
    admin_data = load_admin_data()

    if base_station not in admin_data.get('attached_stations', {}):
        return {'error': 'Опорная станция не найдена'}

    if station_to_detach in admin_data['attached_stations'][base_station]:
        admin_data['attached_stations'][base_station].remove(station_to_detach)
        save_admin_data(admin_data)
        return {'success': True, 'attached': admin_data['attached_stations']}

    return {'success': False, 'message': 'Станция не прикреплена'}


def get_attached_stations(base_station):
    """Получение списка прикрепленных станций"""
    admin_data = load_admin_data()
    return admin_data.get('attached_stations', {}).get(base_station, [])


def add_wagons_data(station_name, count, date=None):
    """Добавление данных о вагонах для станции"""
    if date is None:
        date = datetime.now().strftime('%Y-%m-%d')

    admin_data = load_admin_data()

    if station_name not in admin_data.get('flags', {}):
        return {'error': f'Станция "{station_name}" не является опорной'}

    if 'wagons_data' not in admin_data:
        admin_data['wagons_data'] = {}

    if station_name not in admin_data['wagons_data']:
        admin_data['wagons_data'][station_name] = []

    admin_data['wagons_data'][station_name].append({
        'date': date,
        'count': count
    })

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
    sorted_history = sorted(history, key=lambda x: x['date'])
    return sorted_history[-1]['count'] if sorted_history else 0


def get_all_base_stations_with_wagons():
    """Получение всех опорных станций с историей вагонов и прикрепленными станциями"""
    admin_data = load_admin_data()
    flags = admin_data.get('flags', {})
    wagons_data = admin_data.get('wagons_data', {})
    attached_stations = admin_data.get('attached_stations', {})

    result = {}
    for station_name in flags.keys():
        if flags.get(station_name, False):
            history = wagons_data.get(station_name, [])
            current_count = get_current_wagons(station_name)
            result[station_name] = {
                'is_base': True,
                'wagons_history': history,
                'current_count': current_count,
                'attached_stations': attached_stations.get(station_name, [])
            }

    return result