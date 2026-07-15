from flask import Blueprint, request, jsonify, current_app
from auth import authenticate, register_user
from admin import load_admin_data, set_station_flag, attach_station_to_base, detach_station_from_base, \
    get_attached_stations
from graph_utils import haversine_distance, find_closest_node, dijkstra, reconstruct_path
from data_loader import load_geojson
import json
import os

bp = Blueprint('api', __name__, url_prefix='/api')

ENTERPRISES_FILE = '../front/data/enterprises.json'


def load_enterprises():
    """Загрузка данных о предприятиях"""
    if os.path.exists(ENTERPRISES_FILE):
        try:
            with open(ENTERPRISES_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    return {}


def save_enterprises(data):
    """Сохранение данных о предприятиях"""
    os.makedirs(os.path.dirname(ENTERPRISES_FILE), exist_ok=True)
    with open(ENTERPRISES_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ==================== АУТЕНТИФИКАЦИЯ ====================

@bp.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    login = data.get('login', '').strip()
    password = data.get('password', '').strip()

    result = authenticate(login, password)
    if result:
        return jsonify(result)

    if login and password:
        return jsonify({
            'success': True,
            'user': {
                'login': login,
                'role': 'admin',
                'name': login
            }
        })

    return jsonify({
        'success': False,
        'error': 'Неверный логин или пароль'
    }), 401


@bp.route('/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    login = data.get('login', '').strip()
    password = data.get('password', '').strip()
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()

    result = register_user(login, password, name, email)

    if not result['success']:
        return jsonify(result), 400

    return jsonify(result)


# ==================== АДМИНИСТРИРОВАНИЕ ====================

@bp.route('/admin/data', methods=['GET'])
def get_admin_data():
    return jsonify(load_admin_data())


@bp.route('/admin/flags', methods=['POST'])
def set_flag():
    data = request.get_json()
    station_name = data.get('stationName')
    is_base = data.get('isBase', True)

    if not station_name:
        return jsonify({'error': 'Не указана станция'}), 400

    flags = set_station_flag(station_name, is_base)
    return jsonify({'success': True, 'flags': flags})


@bp.route('/admin/attach', methods=['POST'])
def attach_station():
    data = request.get_json()
    base_station = data.get('baseStation')
    station_to_attach = data.get('stationToAttach')

    if not base_station or not station_to_attach:
        return jsonify({'error': 'Не указаны станции'}), 400

    result = attach_station_to_base(base_station, station_to_attach)

    if 'error' in result:
        return jsonify(result), 400

    return jsonify(result)


@bp.route('/admin/detach', methods=['POST'])
def detach_station():
    data = request.get_json()
    base_station = data.get('baseStation')
    station_to_detach = data.get('stationToDetach')

    if not base_station or not station_to_detach:
        return jsonify({'error': 'Не указаны станции'}), 400

    result = detach_station_from_base(base_station, station_to_detach)
    return jsonify(result)


@bp.route('/admin/attached/<base_station>', methods=['GET'])
def get_attached(base_station):
    attached = get_attached_stations(base_station)
    return jsonify({'base_station': base_station, 'attached': attached})


# ==================== ПРЕДПРИЯТИЯ ====================

@bp.route('/enterprises', methods=['GET'])
def get_enterprises():
    """Получение всех данных о предприятиях"""
    return jsonify(load_enterprises())


@bp.route('/enterprises/<station_name>', methods=['GET'])
def get_enterprise(station_name):
    """Получение данных о предприятии по названию станции"""
    enterprises = load_enterprises()
    if station_name not in enterprises:
        return jsonify({'error': 'Предприятие не найдено'}), 404
    return jsonify(enterprises[station_name])


@bp.route('/enterprises/<station_name>', methods=['PUT'])
def update_enterprise(station_name):
    """Обновление данных о предприятии"""
    data = request.get_json()
    enterprises = load_enterprises()

    if station_name not in enterprises:
        return jsonify({'error': 'Предприятие не найдено'}), 404

    # Обновляем только переданные поля
    if 'wagons' in data:
        enterprises[station_name]['wagons'] = data['wagons']
    if 'loading_speed' in data:
        enterprises[station_name]['loading_speed'] = data['loading_speed']
    if 'technical_means' in data:
        enterprises[station_name]['technical_means'] = data['technical_means']
    if 'products' in data:
        enterprises[station_name]['products'] = data['products']

    save_enterprises(enterprises)
    return jsonify({'success': True, 'data': enterprises[station_name]})


@bp.route('/enterprises/<station_name>/wagons', methods=['PUT'])
def update_wagons_data(station_name):
    """Обновление данных о вагонах на станции"""
    data = request.get_json()
    enterprises = load_enterprises()

    if station_name not in enterprises:
        return jsonify({'error': 'Предприятие не найдено'}), 404

    wagon_type = data.get('type')
    count = data.get('count')

    if wagon_type not in ['empty', 'loaded', 'ready_for_pickup']:
        return jsonify({'error': 'Неверный тип вагонов'}), 400

    if count is None or count < 0:
        return jsonify({'error': 'Неверное количество вагонов'}), 400

    enterprises[station_name]['wagons'][wagon_type] = count
    save_enterprises(enterprises)

    return jsonify({
        'success': True,
        'station': station_name,
        'wagons': enterprises[station_name]['wagons']
    })


@bp.route('/enterprises/<station_name>/products/<product_name>', methods=['PUT'])
def update_product_data(station_name, product_name):
    """Обновление данных о продукте"""
    data = request.get_json()
    enterprises = load_enterprises()

    if station_name not in enterprises:
        return jsonify({'error': 'Предприятие не найдено'}), 404

    if product_name not in enterprises[station_name]['products']:
        return jsonify({'error': 'Продукт не найден'}), 404

    warehouse = data.get('warehouse')
    wagons = data.get('wagons')

    if warehouse is not None:
        enterprises[station_name]['products'][product_name]['warehouse'] = warehouse
    if wagons is not None:
        enterprises[station_name]['products'][product_name]['wagons'] = wagons

    save_enterprises(enterprises)

    return jsonify({
        'success': True,
        'station': station_name,
        'product': product_name,
        'data': enterprises[station_name]['products'][product_name]
    })


# ==================== СТАНЦИИ ====================

@bp.route('/stations', methods=['GET'])
def get_stations():
    station_data = current_app.config['STATION_DATA']
    stations = []

    for feature in station_data.get('features', []):
        props = feature.get('properties', {})
        coords = feature.get('geometry', {}).get('coordinates', [])
        if coords:
            stations.append({
                'name': props.get('name', 'Без названия'),
                'lat': coords[1],
                'lon': coords[0],
                'city': props.get('addr:city', 'Не указан'),
                'branch': props.get('operator:branch', 'Горьковская ЖД'),
                'type': props.get('railway', 'station')
            })
    return jsonify(stations)


@bp.route('/stations/search', methods=['GET'])
def search_stations():
    query = request.args.get('q', '').strip()
    if len(query) < 1:
        return jsonify([])

    station_data = current_app.config['STATION_DATA']
    query_lower = query.lower()
    results = []

    for feature in station_data.get('features', []):
        props = feature.get('properties', {})
        name = props.get('name', '')
        if name and query_lower in name.lower():
            coords = feature.get('geometry', {}).get('coordinates', [])
            if coords:
                results.append({
                    'name': name,
                    'lat': coords[1],
                    'lon': coords[0],
                    'city': props.get('addr:city', 'Не указан'),
                    'branch': props.get('operator:branch', 'Горьковская ЖД'),
                    'type': props.get('railway', 'station')
                })
                if len(results) >= 30:
                    break

    return jsonify(results)


# ==================== ПОСТРОЕНИЕ МАРШРУТА ====================

def find_station_by_name(name, station_data):
    name_normalized = name.lower().strip()

    for feature in station_data.get('features', []):
        props = feature.get('properties', {})
        station_name = props.get('name', '')
        if station_name.lower() == name_normalized:
            coords = feature.get('geometry', {}).get('coordinates', [])
            if coords:
                return {
                    'name': station_name,
                    'lat': coords[1],
                    'lon': coords[0],
                    'city': props.get('addr:city', 'Не указан'),
                    'branch': props.get('operator:branch', 'Горьковская ЖД'),
                    'type': props.get('railway', 'station')
                }

    for feature in station_data.get('features', []):
        props = feature.get('properties', {})
        station_name = props.get('name', '')
        if name_normalized in station_name.lower() or station_name.lower() in name_normalized:
            coords = feature.get('geometry', {}).get('coordinates', [])
            if coords:
                return {
                    'name': station_name,
                    'lat': coords[1],
                    'lon': coords[0],
                    'city': props.get('addr:city', 'Не указан'),
                    'branch': props.get('operator:branch', 'Горьковская ЖД'),
                    'type': props.get('railway', 'station')
                }

    return None


def build_route_sequential(points, graph, node_coords):
    if len(points) < 2:
        return None, {"error": "Нужно минимум 2 точки"}

    debug_info = {
        "node_ids": [],
        "distances_to_road": [],
        "segments": [],
        "warnings": []
    }

    node_ids = []
    for point in points:
        node_id, dist = find_closest_node(point['lat'], point['lon'], node_coords)
        if node_id is None:
            debug_info["warnings"].append(
                f"Станция '{point['name']}' не найдена на дороге (расстояние {dist:.2f} км)"
            )
            return None, debug_info
        node_ids.append(node_id)
        debug_info["node_ids"].append(node_id)
        debug_info["distances_to_road"].append(round(dist, 3))

    full_path = []
    total_distance = 0
    path_segments = []
    all_paths = []

    for i in range(len(node_ids) - 1):
        start_id = node_ids[i]
        end_id = node_ids[i + 1]
        if start_id == end_id:
            path_segments.append({
                'from': points[i]['name'],
                'to': points[i + 1]['name'],
                'distance_km': 0,
                'points_count': 1,
                'warning': 'Точки совпадают'
            })
            continue

        previous, visited = dijkstra(graph, start_id, end_id)

        if visited and end_id not in visited:
            debug_info["warnings"].append(
                f"Нет пути от '{points[i]['name']}' к '{points[i + 1]['name']}'"
            )
            previous_rev, visited_rev = dijkstra(graph, end_id, start_id)
            if visited_rev and start_id in visited_rev:
                previous = previous_rev
                path_ids = reconstruct_path(previous, end_id, start_id)
                if path_ids:
                    path_ids.reverse()
                else:
                    continue
            else:
                continue
        else:
            path_ids = reconstruct_path(previous, start_id, end_id)

        if path_ids is None or len(path_ids) < 2:
            debug_info["warnings"].append(
                f"Путь от '{points[i]['name']}' к '{points[i + 1]['name']}' не найден"
            )
            continue

        path_coords = [
            {'lat': node_coords[node_id]['lat'], 'lon': node_coords[node_id]['lon']}
            for node_id in path_ids
        ]

        segment_distance = 0
        for j in range(len(path_coords) - 1):
            p1 = path_coords[j]
            p2 = path_coords[j + 1]
            segment_distance += haversine_distance(p1['lat'], p1['lon'], p2['lat'], p2['lon'])

        path_segments.append({
            'from': points[i]['name'],
            'to': points[i + 1]['name'],
            'distance_km': round(segment_distance, 2),
            'points_count': len(path_coords)
        })

        total_distance += segment_distance
        all_paths.append(path_coords)

    if all_paths:
        full_path = all_paths[0]
        for i in range(1, len(all_paths)):
            if len(all_paths[i]) > 1:
                if len(full_path) > 0 and len(all_paths[i]) > 0:
                    last_point = full_path[-1]
                    first_point = all_paths[i][0]
                    if (abs(last_point['lat'] - first_point['lat']) < 0.0001 and
                            abs(last_point['lon'] - first_point['lon']) < 0.0001):
                        full_path.extend(all_paths[i][1:])
                    else:
                        full_path.extend(all_paths[i])
                else:
                    full_path.extend(all_paths[i])

    debug_info["segments"] = path_segments
    debug_info["total_distance"] = round(total_distance, 2)

    return full_path, debug_info


@bp.route('/route', methods=['POST'])
def calculate_route():
    try:
        data = request.get_json()
    except:
        return jsonify({'error': 'Неверный формат JSON'}), 400

    if not data or 'points' not in data:
        return jsonify({'error': 'Не переданы точки маршрута'}), 400

    points = data['points']

    if len(points) < 2:
        return jsonify({'error': 'Нужно минимум 2 точки'}), 400

    station_data = current_app.config['STATION_DATA']
    graph = current_app.config['GRAPH']
    node_coords = current_app.config['NODE_COORDS']

    route_points = []
    for point in points:
        if 'name' in point:
            station = find_station_by_name(point['name'], station_data)
            if station:
                route_points.append(station)
            else:
                return jsonify({'error': f'Станция "{point["name"]}" не найдена'}), 404
        elif 'lat' in point and 'lon' in point:
            station = None
            for feat in station_data.get('features', []):
                coords = feat.get('geometry', {}).get('coordinates', [])
                if coords:
                    dist = haversine_distance(point['lat'], point['lon'], coords[1], coords[0])
                    if dist < 1.0:
                        props = feat.get('properties', {})
                        station = {
                            'name': props.get('name', 'Без названия'),
                            'lat': coords[1],
                            'lon': coords[0],
                            'city': props.get('addr:city', 'Не указан'),
                            'branch': props.get('operator:branch', 'Горьковская ЖД'),
                            'type': props.get('railway', 'station')
                        }
                        break
            if not station:
                station = {
                    'name': f"Точка {len(route_points) + 1}",
                    'lat': point['lat'],
                    'lon': point['lon'],
                    'city': 'Не указан',
                    'branch': 'Горьковская ЖД',
                    'type': 'point'
                }
            route_points.append(station)
        else:
            return jsonify({'error': 'Неверный формат точки'}), 400

    path, debug_info = build_route_sequential(route_points, graph, node_coords)

    if path is None or len(path) < 2:
        error_msg = debug_info.get('warnings', ['Не удалось построить маршрут'])[0]
        return jsonify({
            'error': error_msg,
            'debug': debug_info
        }), 500

    result = {
        'points': route_points,
        'path': path,
        'total_points': len(path),
        'stations_count': len(route_points),
        'distance': {
            'route_km': debug_info.get('total_distance', 0),
            'segments': debug_info.get('segments', [])
        },
        'debug': debug_info
    }

    return jsonify(result)


# ==================== СТАТУС ====================

@bp.route('/status', methods=['GET'])
def status():
    station_data = current_app.config['STATION_DATA']
    graph = current_app.config['GRAPH']
    return jsonify({
        'status': 'ok',
        'stations': len(station_data.get('features', [])),
        'graph_nodes': len(graph)
    })


# ==================== ВАГОНЫ ====================

@bp.route('/admin/wagons/all', methods=['GET'])
def get_all_wagons():
    from admin import get_all_base_stations_with_wagons

    stations = get_all_base_stations_with_wagons()
    return jsonify(stations)


@bp.route('/admin/wagons/add', methods=['POST'])
def add_wagons():
    from admin import add_wagons_data

    data = request.get_json()
    station_name = data.get('stationName')
    count = data.get('count')
    date = data.get('date')

    if not station_name or count is None:
        return jsonify({'error': 'Не указана станция или количество вагонов'}), 400

    try:
        count = int(count)
    except:
        return jsonify({'error': 'Количество вагонов должно быть числом'}), 400

    result = add_wagons_data(station_name, count, date)

    if 'error' in result:
        return jsonify(result), 400

    return jsonify({
        'success': True,
        'station': station_name,
        'data': result
    })