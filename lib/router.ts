import type { ExtractedData } from '@/lib/ai';
import type { WeatherAssessment } from '@/lib/weather';

export interface RouteResult {
  action: string;
  final_priority: ExtractedData['priority'];
  tags: string[];
}

export function routeMessage(data: ExtractedData, weather: WeatherAssessment | null): RouteResult {
  const badWeather = weather?.is_bad_weather ?? false;
  let finalPriority = data.priority;
  const tags: string[] = [];

  // --- Sentiment escalation ---
  if (data.sentiment === 'frustrated') {
    if (finalPriority === 'low') finalPriority = 'medium';
    else if (finalPriority === 'medium') finalPriority = 'high';

    tags.push('escalated');
  }

  // --- Language tagging ---
  if (data.language === 'other') {
    tags.push('needs-translation');
  }

  // --- Routing table ---
  const { category } = data;

  // Missed delivery or delay + bad weather
  if ((category === 'missed delivery' || category === 'delay') && badWeather) {
    return {
      action: 'Possible weather delay, check route',
      final_priority: finalPriority,
      tags,
    };
  }

  // Missed delivery + good weather
  if (category === 'missed delivery' && !badWeather) {
    return {
      action: 'Urgent - no excuse, investigate immediately',
      final_priority: 'high',
      tags: [...tags, 'no-excuse'],
    };
  }

  // Delay + good weather (not in spec — my addition)
  if (category === 'delay' && !badWeather) {
    return {
      action: 'Delay without weather cause - check logistics',
      final_priority: finalPriority,
      tags,
    };
  }

  // Damage - always urgent
  if (category === 'damage') {
    return {
      action: 'Urgent - mark as high priority',
      final_priority: 'high',
      tags: [...tags, 'damage'],
    };
  }

  // General question - auto reply
  if (category === 'general question') {
    return {
      action: 'Automatic reply via email or Slack',
      final_priority: finalPriority,
      tags,
    };
  }

  // Compliment
  if (category === 'compliment') {
    return {
      action: 'The team deserves to smile too',
      final_priority: 'low',
      tags,
    };
  }

  // Other / fallback
  return {
    action: 'Needs manual review',
    final_priority: finalPriority,
    tags: [...tags, 'needs-review'],
  };
}