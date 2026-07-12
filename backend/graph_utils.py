import math
import heapq
from collections import defaultdict

def haversine_distance(lat1, lon1, lat2, lon2):
    """Расчет расстояния между двумя точками на сфере"""
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

def build_graph(railway_data):
    """Построение графа из данных железных дорог"""
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

def find_closest_node(lat, lon, node_coords, max_distance=15.0):
    """Поиск ближайшего узла графа"""
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

def dijkstra(graph, start_id, end_id):
    """Алгоритм Дейкстры для поиска кратчайшего пути"""
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

def reconstruct_path(previous, start_id, end_id):
    """Восстановление пути из результатов Дейкстры"""
    if end_id not in previous or previous[end_id] is None and start_id != end_id:
        return None

    path = []
    current = end_id
    while current is not None:
        path.append(current)
        current = previous[current]
    path.reverse()
    return path