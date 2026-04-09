export interface GeoResult {
  lat: number;
  lon: number;
  displayName: string;
}

export interface WeatherData {
  temperature_c: number;
  windspeed_kmh: number;
  precipitation_mm: number;
  snowfall_cm: number;
  weather_code: number;
}

export interface WeatherAssessment {
  is_bad_weather: boolean;
  reasons: string[];
  raw: WeatherData;
}

// --- Geocoding via Nominatim (OpenStreetMap) ---
export async function geocodeLocation(location: string): Promise<GeoResult | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', location);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  // Bias toward the Netherlands since Snelpost is Dutch from my understanding
  url.searchParams.set('countrycodes', 'nl');

  const res = await fetch(url.toString(), {
    headers: {
      // Nominatim requires a User-Agent idenifying the app
      'User-Agent': 'snelpost-intake/1.0',
    },
  });

  if (!res.ok) return null;

  const data: Array<{ lat: string; lon: string; display_name: string }> = await res.json();

  if (data.length === 0) return null;

  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
}

// --- Weather vida Open-Meteo [as requested] ---
export async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat.toString());
  url.searchParams.set('longitude', lon.toString());
  url.searchParams.set('current', 'temperature_2m,wind_speed_10m,precipitation,snowfall,weather_code');

  const res = await fetch(url.toString());

  if (!res.ok) return null;

  const data = await res.json();
  const current = data.current;

  return {
    temperature_c: current.temperature_2m,
    windspeed_kmh: current.wind_speed_10m,
    precipitation_mm: current.precipitation,
    snowfall_cm: current.snowfall,
    weather_code: current.weather_code,
  }
}

// --- Bad Weather Logic ---
//
// Why these thresholds?
// - precipitation > 2mm/h: moderate rain, roads get slippery, parcels risk water damage
// - windspeed > 40km/h: strong gusts make driving vans dangerous, especially on highways
// - snowfall > 0cm: any snow affects Dutch roads significantly (flat terrain, often untreated side roads)
// - temperature < 0°C: ice on roads causes delays and safety risk for drivers
//
// These are deliberately conservative — for a delivery company, it's better to
// flag a borderline day as "bad" and have the team check, than to miss a storm.

export function assessWeather(weather: WeatherData): WeatherAssessment {
  const reasons: string[] = [];

  if (weather.precipitation_mm > 2) {
    reasons.push(`Heavy rain: ${weather.precipitation_mm}mm/h`);
  }

  if (weather.windspeed_kmh > 40) {
    reasons.push(`Strong wind: ${weather.windspeed_kmh}km/h`);
  }

  if (weather.snowfall_cm > 0) {
    reasons.push(`Snowfall: ${weather.snowfall_cm}cm`);
  }

  if (weather.temperature_c < 0) {
    reasons.push(`Freezing: ${weather.temperature_c}`);
  }

  return {
    is_bad_weather: reasons.length > 0,
    reasons,
    raw: weather,
  };
}