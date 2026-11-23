from .weather import get_current_weather, get_city_coordinates


AVAILABLE_TOOLS = [
    get_current_weather,
    ]


TOOL_MAP = {
    'get_current_weather': get_current_weather,
    }