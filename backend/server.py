from flask import Flask, jsonify, request
import requests
import xml.etree.ElementTree as ET
from datetime import datetime
import json
import os
from threading import Lock
app = Flask(__name__)
@app.after_request
def after_request(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    return response
VOTES_FILE = 'votes.json'
votes_lock = Lock()
if not os.path.exists(VOTES_FILE):
    with open(VOTES_FILE, 'w') as f:
        json.dump({}, f)
def load_votes():
    """Load votes from file"""
    with votes_lock:
        try:
            with open(VOTES_FILE, 'r') as f:
                return json.load(f)
        except:
            return {}
def save_votes_to_file(votes_data):
    """Save votes to file"""
    with votes_lock:
        with open(VOTES_FILE, 'w') as f:
            json.dump(votes_data, f, indent=2)
POSTAL_TO_CITY = {
    'M': {'city': 'Toronto', 'code': 's0000458'},
    'K': {'city': 'Ottawa', 'code': 's0000430'},
    'H': {'city': 'Montreal', 'code': 's0000635'},
    'V': {'city': 'Vancouver', 'code': 's0000141'},
    'T': {'city': 'Calgary', 'code': 's0000047'},
    'E': {'city': 'Fredericton', 'code': 's0000250'},
    'B': {'city': 'Halifax', 'code': 's0000318'},
    'C': {'city': 'Charlottetown', 'code': 's0000583'},
    'A': {'city': 'St. Johns', 'code': 's0000280'},
    'S': {'city': 'Saskatoon', 'code': 's0000797'},
    'R': {'city': 'Winnipeg', 'code': 's0000193'},
    'G': {'city': 'Quebec City', 'code': 's0000620'},
    'J': {'city': 'Sherbrooke', 'code': 's0000442'},
    'L': {'city': 'Waterloo', 'code': 's0000650'},
    'N': {'city': 'London', 'code': 's0000326'},
    'P': {'city': 'Sault Ste Marie', 'code': 's0000509'},
    'X': {'city': 'Yellowknife', 'code': 's0000366'},
    'Y': {'city': 'Whitehorse', 'code': 's0000825'},
}
@app.route('/api/weather', methods=['GET'])
def get_weather():
    postal_code = request.args.get('postal_code', '').upper()
    if not postal_code or len(postal_code) < 3:
        return jsonify({'error': 'Invalid postal code'}), 400
    first_letter = postal_code[0]
    city_info = POSTAL_TO_CITY.get(first_letter)
    if not city_info:
        return jsonify({'error': 'Postal code not supported'}), 400
    try:
        current_url = f"https://dd.weather.gc.ca/citypage_weather/xml/{city_info['code'][0:2].upper()}/{city_info['code']}_e.xml"
        print(f"Fetching weather for {city_info['city']} from: {current_url}")
        response = requests.get(current_url, timeout=10)
        response.raise_for_status()
        print(f"Successfully fetched data, parsing XML...")
        root = ET.fromstring(response.content)
        current_temp = None
        current_snowfall = 0
        wind_speed = 0
        temp_elem = root.find(".//currentConditions/temperature")
        if temp_elem is not None and temp_elem.text:
            current_temp = float(temp_elem.text)
        wind_elem = root.find(".//currentConditions/wind/speed")
        if wind_elem is not None and wind_elem.text:
            try:
                wind_speed = float(wind_elem.text)
            except:
                wind_speed = 0
        hourly_data = []
        forecast_groups = root.findall(".//forecastGroup/forecast")
        for i in range(8):
            hourly_data.append({
                'time': datetime.now().replace(hour=(datetime.now().hour + i) % 24).isoformat(),
                'snowfall': 0,
                'temperature': current_temp if current_temp else 0,
                'wind_speed': wind_speed
            })
        total_precip = 0
        total_snow = 0
        min_temp = current_temp if current_temp else 0
        max_wind = wind_speed
        for forecast in forecast_groups[:2]:  # Check first 2 periods (today and tonight)
            precip_elem = forecast.find(".//precipitation/accumulation/amount")
            if precip_elem is not None and precip_elem.text:
                try:
                    amount = float(precip_elem.text)
                    total_precip += amount
                    precip_type = forecast.find(".//precipitation/accumulation/name")
                    if precip_type is not None and 'snow' in precip_type.text.lower():
                        total_snow += amount
                        for j in range(min(4, len(hourly_data))):
                            hourly_data[j]['snowfall'] += amount / 4
                except:
                    pass
            temperatures = forecast.find(".//temperatures")
            if temperatures is not None:
                temp_elem = temperatures.find(".//temperature")
                if temp_elem is not None and temp_elem.text:
                    try:
                        temp_val = float(temp_elem.text)
                        min_temp = min(min_temp, temp_val)
                    except:
                        pass
            wind_elem = forecast.find(".//winds/wind/speed")
            if wind_elem is not None and wind_elem.text:
                try:
                    wind_val = float(wind_elem.text)
                    max_wind = max(max_wind, wind_val)
                except:
                    pass
        weather_data = {
            'current': {
                'temperature_2m': current_temp if current_temp else 0,
                'snowfall': current_snowfall,
                'wind_speed_10m': wind_speed,
                'precipitation': 0
            },
            'hourly': {
                'time': [h['time'] for h in hourly_data],
                'snowfall': [h['snowfall'] for h in hourly_data],
                'temperature_2m': [h['temperature'] for h in hourly_data],
                'wind_speed_10m': [h['wind_speed'] for h in hourly_data]
            },
            'daily': {
                'snowfall_sum': [total_snow],
                'precipitation_sum': [total_precip],
                'temperature_2m_min': [min_temp]
            },
            'city': city_info['city'],
            'source': 'Environment Canada'
        }
        return jsonify(weather_data)
    except requests.RequestException as e:
        print(f"Request error: {str(e)}")
        return jsonify({'error': f'Failed to fetch weather data: {str(e)}'}), 500
    except Exception as e:
        print(f"Processing error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Error processing weather data: {str(e)}'}), 500
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'source': 'Environment Canada'})
@app.route('/api/votes', methods=['GET', 'OPTIONS'])
def get_votes():
    """Get votes for a specific location"""
    location = request.args.get('location', '')
    if not location:
        return jsonify({'error': 'Location required'}), 400
    all_votes = load_votes()
    location_votes = all_votes.get(location, {'yes': 0, 'no': 0})
    return jsonify({
        'location': location,
        'votes': location_votes
    })
@app.route('/api/vote', methods=['POST', 'OPTIONS'])
def submit_vote():
    """Submit a vote for a location"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'})
    data = request.get_json()
    location = data.get('location')
    vote = data.get('vote')  # 'yes' or 'no'
    if not location or vote not in ['yes', 'no']:
        return jsonify({'error': 'Invalid request'}), 400
    all_votes = load_votes()
    if location not in all_votes:
        all_votes[location] = {'yes': 0, 'no': 0}
    all_votes[location][vote] += 1
    save_votes_to_file(all_votes)
    return jsonify({
        'success': True,
        'location': location,
        'votes': all_votes[location]
    })
@app.route('/api/vote/change', methods=['POST', 'OPTIONS'])
def change_vote():
    """Change a vote from one option to another"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'})
    data = request.get_json()
    location = data.get('location')
    old_vote = data.get('oldVote')  # 'yes' or 'no'
    new_vote = data.get('newVote')  # 'yes' or 'no'
    if not location or old_vote not in ['yes', 'no'] or new_vote not in ['yes', 'no']:
        return jsonify({'error': 'Invalid request'}), 400
    all_votes = load_votes()
    if location not in all_votes:
        all_votes[location] = {'yes': 0, 'no': 0}
    all_votes[location][old_vote] = max(0, all_votes[location][old_vote] - 1)
    all_votes[location][new_vote] += 1
    save_votes_to_file(all_votes)
    return jsonify({
        'success': True,
        'location': location,
        'votes': all_votes[location]
    })
if __name__ == '__main__':
    print("Starting Weather Proxy Server...")
    print("Using Environment Canada as data source")
    print(f"Votes stored in: {os.path.abspath(VOTES_FILE)}")
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
