import { NextResponse } from 'next/server';
import { extractMessageData } from '@/lib/ai';
import { geocodeLocation, fetchWeather, assessWeather, type WeatherAssessment } from '@/lib/weather';
import { routeMessage } from '@/lib/router';

export async function POST(request: Request) {
  // --- 1. Parse body ---
  let body: { message?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400});
  }

  if (!body.message || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'Missing required field: "message" (string)' }, { status: 400 });
  }

  const { message } = body;

  // --- 2. AI extraction ---
  const extracted = await extractMessageData(message);

  // --- 3. Geocode + Weather ---
  let weatherAssessment: WeatherAssessment | null = null;
  let geoInfo: { lat: number; lon: number; displayName: string } | null = null;

  if (extracted.location) {
    const geo = await geocodeLocation(extracted.location);

    if (geo) {
      geoInfo = geo;
      const weather = await fetchWeather(geo.lat, geo.lon);

      if (weather) {
        weatherAssessment = assessWeather(weather);
      }
    }
  }

  // --- 4. Route ---
  const routeResult = routeMessage(extracted, weatherAssessment);

  // --- 5. Build payload ---
  const payload = {
    timestamp: new Date().toISOString(),
    original_message: message,
    extracted: {
      category: extracted.category,
      priority: extracted.priority,
      summary: extracted.summary,
      location: extracted.location,
      language: extracted.language,
      sentiment: extracted.sentiment,
      suggested_reply: extracted.suggested_reply,
    },
    weather: weatherAssessment
      ? {
        is_bad_weather: weatherAssessment.is_bad_weather,
        reasons: weatherAssessment.reasons,
        temperature_c: weatherAssessment.raw.temperature_c,
        windspeed_kmh: weatherAssessment.raw.windspeed_kmh,
        precipitation_mm: weatherAssessment.raw.precipitation_mm,
        snowfall_cm: weatherAssessment.raw.snowfall_cm,
      } : null,
    geo: geoInfo
      ? { lat: geoInfo.lat, lon: geoInfo.lon, display_name: geoInfo.displayName }
      : null,
    routing: {
      action: routeResult.action,
      final_priority: routeResult.final_priority,
      tags: routeResult.tags,
    },
  };

  // --- 6. Send to webhook.site ---
  const webhookUrl = process.env.WEBHOOK_SITE_URL;

  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Failed to send to webhook: ', err);
    }
  } else {
    console.warn('WEBHOOK_SITE_URL not set, skipping outbound webhook');
  }

  // --- 7. Return response ---
  return NextResponse.json(payload, {status: 200 });
}