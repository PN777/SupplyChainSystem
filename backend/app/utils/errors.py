from flask import jsonify


def json_error(message, status=400):
    return jsonify({"error": message}), status
