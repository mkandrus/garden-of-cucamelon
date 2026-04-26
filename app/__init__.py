import os
from flask import Flask, send_from_directory
from .sensors.light.routes import light_blueprint
from .sensors.pump.routes import pump_blueprint
from .sensors.distance.routes import distance_blueprint
from .sensors.temperature.routes import temperature_blueprint
from .sensors.humidity.routes import humidity_blueprint
from .sensors.pcb_temp.routes import pcb_temp_blueprint
from .photos.routes import photos_blueprint
from .schedule.routes import schedule_blueprint

def create_app(config_name):
    app = Flask(__name__)

    # from your_flask_app.config import Config
    # app.config.from_object(Config)

    # Register blueprints
    app.register_blueprint(light_blueprint, url_prefix='/light')
    app.register_blueprint(pump_blueprint, url_prefix='/pump')
    app.register_blueprint(distance_blueprint, url_prefix='/distance')
    app.register_blueprint(temperature_blueprint, url_prefix='/temperature')
    app.register_blueprint(humidity_blueprint, url_prefix='/humidity')
    app.register_blueprint(pcb_temp_blueprint, url_prefix='/pcb-temp')
    app.register_blueprint(photos_blueprint, url_prefix='/photos')
    app.register_blueprint(schedule_blueprint, url_prefix='/schedule')

    # Serve React build — catch-all must be registered last
    dist_dir = os.path.realpath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist'))

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_gui(path):
        full = os.path.join(dist_dir, path)
        if path and os.path.exists(full):
            return send_from_directory(dist_dir, path)
        return send_from_directory(dist_dir, 'index.html')

    # @app.teardown_appcontext
    # def shutdown_session(exception=None):
        # pump_control = PumpControl()
        # pump_control.close()

    return app
