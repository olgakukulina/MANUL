import json

def load_geojson(filename):
    """Загрузка GeoJSON файла"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Файл {filename} не найден!")
        return {"features": []}

def init_data(railway_data):
    """Инициализация графа из данных железных дорог"""
    from graph_utils import build_graph
    return build_graph(railway_data)