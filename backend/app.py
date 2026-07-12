from flask import Flask
from flask_cors import CORS
from routes import bp
from data_loader import load_geojson, init_data


def create_app():
    app = Flask(__name__)
    CORS(app)

    # Загрузка данных
    railway_data = load_geojson('../front/data/railways.geojson')
    station_data = load_geojson('../front/data/stations.geojson')

    # Инициализация графа
    graph, node_coords = init_data(railway_data)

    # Добавление данных в контекст приложения
    app.config['GRAPH'] = graph
    app.config['NODE_COORDS'] = node_coords
    app.config['RAILWAY_DATA'] = railway_data
    app.config['STATION_DATA'] = station_data

    # Регистрация маршрутов
    app.register_blueprint(bp)

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)