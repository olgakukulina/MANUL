from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import math
import heapq
from collections import defaultdict
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

ADMIN_DATA_FILE = 'data/admin_data.json'


def load_admin_data():

    if os.path.exists(ADMIN_DATA_FILE):
        try:
            with open(ADMIN_DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {'flags': {}, 'circles': []}
    return {'flags': {}, 'circles': []}


def save_admin_data(data):
    os.makedirs(os.path.dirname(ADMIN_DATA_FILE), exist_ok=True)
    with open(ADMIN_DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)



users_db = {
    'admin': {
        'password': 'admin123',
        'role': 'admin',
        'name': 'Администратор',
        'email': 'admin@example.com'
    },
    'user': {
        'password': 'user123',
        'role': 'user',
        'name': 'Пользователь',
        'email': 'user@example.com'
    }
}

# загрузка входа
@app.route('/api/auth/login', methods=['POST'])
def login():

    data = request.get_json()
    login = data.get('login', '').strip()
    password = data.get('password', '').strip()

    if login in users_db and users_db[login]['password'] == password:
        return jsonify({
            'success': True,
            'user': {
                'login': login,
                'role': users_db[login]['role'],
                'name': users_db[login]['name']
            }
        })

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

# регистрация

@app.route('/api/auth/register', methods=['POST'])
def register():

    data = request.get_json()
    login = data.get('login', '').strip()
    password = data.get('password', '').strip()
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()

    if not login or not password:
        return jsonify({
            'success': False,
            'error': 'Логин и пароль обязательны'
        }), 400

    users_db[login] = {
        'password': password,
        'role': 'admin' if login == 'admin' else 'user',
        'name': name or login,
        'email': email or ''
    }

    return jsonify({
        'success': True,
        'message': 'Регистрация успешна!',
        'user': {
            'login': login,
            'role': users_db[login]['role'],
            'name': users_db[login]['name']
        }
    })




# подгрузка данных об админах
@app.route('/api/admin/data', methods=['GET'])
def get_admin_data():
    return jsonify(load_admin_data())

# опорные пункты
@app.route('/api/admin/flags', methods=['POST'])
def set_flag():
    data = request.get_json()
    station_name = data.get('stationName')
    is_base = data.get('isBase', True)

    if not station_name:
        return jsonify({'error': 'Не указана станция'}), 400

    admin_data = load_admin_data()

    if is_base:
        admin_data['flags'][station_name] = True
    else:
        admin_data['flags'].pop(station_name, None)

    save_admin_data(admin_data)
    return jsonify({'success': True, 'flags': admin_data['flags']})


# загрузка джейсрнов с данными
def load_geojson(filename):
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Файл {filename} не найден!")
        return {"features": []}


railway_data = load_geojson('railways.geojson')
station_data = load_geojson('stations.geojson')
print(f"Дорог: {len(railway_data.get('features', []))}")
print(f"Станций: {len(station_data.get('features', []))}")

# рассчет маршрута километраж
def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371.0
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    return R * c

# расчет количества графов
def build_graph(railway_data):
    graph = defaultdict(dict)
    node_coords = {}
    node_id = 0

    def get_node_id(lat, lon):
        nonlocal node_id
        key = f"{lat:.6f},{lon:.6f}"
        if key not in node_coords:
            node_coords[key] = {
                'id': node_id,
                'lat': lat,
                'lon': lon
            }
            node_id += 1
        return node_coords[key]['id']

    for feature in railway_data.get('features', []):
        geometry = feature.get('geometry')
        if not geometry or geometry.get('type') != 'LineString':
            continue

        coords = geometry.get('coordinates', [])
        for i in range(len(coords) - 1):
            lon1, lat1 = coords[i]
            lon2, lat2 = coords[i + 1]

            id1 = get_node_id(lat1, lon1)
            id2 = get_node_id(lat2, lon2)

            dist = haversine_distance(lat1, lon1, lat2, lon2)

            if dist < 5.0:
                graph[id1][id2] = dist
                graph[id2][id1] = dist

    coords = {}
    for key, data in node_coords.items():
        coords[data['id']] = {
            'lat': data['lat'],
            'lon': data['lon']
        }
    return graph, coords


graph, node_coords = build_graph(railway_data)

# поиск ближайшего узла
def find_closest_node(lat, lon, node_coords, max_distance=15.0):
    best_id = None
    best_dist = float('inf')

    for node_id, coords in node_coords.items():
        dist = haversine_distance(lat, lon, coords['lat'], coords['lon'])
        if dist < best_dist:
            best_dist = dist
            best_id = node_id

    if best_dist > max_distance:
        return None, best_dist

    return best_id, best_dist

# дейкстра
def dijkstra(graph, start_id, end_id):
    if start_id not in graph or end_id not in graph:
        return None, None

    distances = {node: float('inf') for node in graph}
    previous = {node: None for node in graph}
    distances[start_id] = 0

    pq = [(0, start_id)]
    visited = set()

    while pq:
        current_dist, current_id = heapq.heappop(pq)

        if current_id in visited:
            continue
        visited.add(current_id)

        if current_id == end_id:
            break

        for neighbor_id, weight in graph[current_id].items():
            if neighbor_id in visited:
                continue

            new_dist = current_dist + weight
            if new_dist < distances[neighbor_id]:
                distances[neighbor_id] = new_dist
                previous[neighbor_id] = current_id
                heapq.heappush(pq, (new_dist, neighbor_id))

    return previous, visited

# построение пути маршрута
def reconstruct_path(previous, start_id, end_id):
    if end_id not in previous or previous[end_id] is None and start_id != end_id:
        return None

    path = []
    current = end_id
    while current is not None:
        path.append(current)
        current = previous[current]
    path.reverse()
    return path

# поиск станции
def find_station_by_name(name):
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

# построение маршрута
def build_route_sequential(points):
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

# станции
@app.route('/api/stations', methods=['GET'])
def get_stations():
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

# просто поиск станций
@app.route('/api/stations/search', methods=['GET'])
def search_stations():
    query = request.args.get('q', '').strip()
    if len(query) < 1:
        return jsonify([])

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

# построить маршрут
@app.route('/api/route', methods=['POST'])
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

    route_points = []
    for point in points:
        if 'name' in point:
            station = find_station_by_name(point['name'])
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

    path, debug_info = build_route_sequential(route_points)

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

# статус
@app.route('/api/status', methods=['GET'])
def status():
    return jsonify({
        'status': 'ok',
        'stations': len(station_data.get('features', [])),
        'graph_nodes': len(graph)
    })


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)