import requests
import socket
import urllib3.util.connection as urllib3_cn

from typing import TypedDict


urllib3_cn.allowed_gai_family = lambda: socket.AF_INET

class HourlyData(TypedDict):
    time: list[str]
    temperature_2m: list[float]

class HourlyUnits(TypedDict):
    temperature_2m: str

class WeatherInfo(TypedDict):
    timezone: str
    timezone_abbreviation: str
    hourly: HourlyData
    hourly_units: HourlyUnits

class CityInfo(TypedDict):
    latitude: float
    longitude: float
    timezone: str
    country_code: str


def get_current_weather(city: str, forecast_days: int = 1) -> WeatherInfo | str:
    """
    Get the current weather for a given city.

    Args:
        city: Name of the City. Append a country after a comma to narrow
            the results (e.g., "Berlin, DE" or "Davao City, PH").
        forecast_days: The number of days for the weather forcast. Default = 1.

    Returns:
        A dictionary containing the timezone, timezone_abbreviation, hourly data and the temperature unit of
        the hourly data.
    
    """

    city_details = get_city_coordinates(city)
    if not city_details:
        return f'No weather information for {city}'

    url = 'https://api.open-meteo.com/v1/forecast'
    params = {
        'latitude': city_details.get('latitude'),
        'longitude': city_details.get('longitude'),
        'hourly': ['temperature_2m', 'relative_humidity_2m', 'precipitation_probability', 'rain'],
        'models': 'ecmwf_ifs',
        'forecast_days': forecast_days,
    }

    response = requests.get(url, params = params, timeout = 30)
    response.raise_for_status()

    results = response.json()

    if not results:
        return f'No weather information for {city}'

    return {
        'hourly': results['hourly'],
        'timezone': results['timezone'],
        'timezone_abbreviation': results['timezone_abbreviation'],
        'hourly_units': results['hourly_units'],
    }


def get_city_coordinates(city: str) -> CityInfo | None:
    """
    Get the coordinates for a given city.

    Args:
    city: Name of the City. Append a country after a comma to narrow
        the results (e.g., "Berlin, DE" or "Davao City, PH").

    Returns:
        A dictionary containing latitude, longitude, timezone and
        country_code if found, otherwise None.
    """

    url = 'https://geocoding-api.open-meteo.com/v1/search'
    params = {
        'name': city,
        'count': 1,
    }

    response = requests.get(url, params = params, timeout = 10)
    response.raise_for_status()

    results = response.json().get('results', [])

    if not results:
        return None

    first_match = results[0]

    return {
        'latitude': first_match['latitude'],
        'longitude': first_match['longitude'],
        'country_code': first_match['country_code'],
        'timezone': first_match['timezone']
    }
