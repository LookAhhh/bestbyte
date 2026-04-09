# Snelpost Intake Webhook

Smart intake system that automatically reads, understands, and routes incoming customer messages — enriched with weather context.

**Live URL:** `https://bestbyte-seven.vercel.app`

Webhook endpoint: `POST https://bestbyte-seven.vercel.app/api/intake`

## Architecture

```
POST /api/intake { "message": "..." }
  → AI extraction (GPT-4o-mini via Vercel AI SDK + Zod)
  → Geocoding (Nominatim/OpenStreetMap)
  → Weather (Open-Meteo)
  → Routing logic (category + weather → action)
  → Outbound webhook (webhook.site)
```

## Setup

### Running locally

1. Install dependencies:
```bash
bun install
```

2. Create `.env.local`:
```env
OPENAI_API_KEY=sk-your-key-here
WEBHOOK_SITE_URL=https://webhook.site/your-unique-id
```

3. Start the dev server:
```bash
bun run dev
```

### Deployed on Vercel

Environment variables (`OPENAI_API_KEY` and `WEBHOOK_SITE_URL`) are configured in the Vercel project settings under **Settings → Environment Variables**.

## Testing

Use [Postman](https://www.postman.com/) to send a test request:

1. Open Postman and create a new request
2. Set method to **POST**
3. Set URL to:
   - **Production:** `https://bestbyte-seven.vercel.app/api/intake`
   - **Local:** `http://localhost:3000/api/intake`
4. Go to **Body** → select **raw** → set type to **JSON**
5. Paste one of the following example payloads and hit **Send**

**Missed delivery:**
```json
{"message": "My parcel was supposed to be delivered yesterday but nobody came. Postcode 3521AL. What now?"}
```

**Damage report:**
```json
{"message": "My package arrived completely smashed, contents broken. Amsterdam."}
```

**General question:**
```json
{"message": "Do you deliver on Saturdays to Rotterdam?"}
```

**Compliment:**
```json
{"message": "Just want to say your driver was super friendly today, thanks!"}
```

**Dutch message:**
```json
{"message": "Mijn pakket is al 3 dagen te laat! Postcode 1012AB. Dit is belachelijk!"}
```

The full processed payload will appear in the Postman response panel and simultaneously on your [webhook.site](https://webhook.site) page.

## Weather Logic

Bad weather is flagged when **any** of these conditions are true:

| Condition | Threshold | Reasoning |
|---|---|---|
| Precipitation | > 2mm/h | Moderate rain — slippery roads, parcel water damage risk |
| Wind speed | > 40km/h | Dangerous for delivery vans, especially on highways |
| Snowfall | > 0cm | Any snow significantly impacts Dutch roads |
| Temperature | < 0°C | Ice risk on roads, driver safety concern |

## Routing Table

| Situation | Action |
|---|---|
| Missed delivery/delay + bad weather | Possible weather delay, check route |
| Missed delivery + good weather | Urgent — no excuse, investigate |
| Delay + good weather | Check logistics |
| Damage | Urgent — mark as high priority |
| General question | Automatic reply via email or Slack |
| Compliment | The team deserves to smile too |
| Other | Needs manual review |

## Extra Features

- **Sentiment detection** — frustrated customers get priority escalation
- **Language detection** — non-Dutch/English messages tagged for translation
- **Auto-reply drafts** — general questions get a suggested reply

## Assumptions

- Weather thresholds are conservative — better to flag and have team verify
- Geocoding is biased to Netherlands (`countrycodes=nl`)
- GPT-4o-mini is used for cost/speed balance
- Outbound webhook failure doesn't block the response
- No database or queue — synchronous processing per the MVP scope

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript** (strict)
- **Vercel AI SDK** + **Zod** (structured AI output)
- **Open-Meteo** (weather, no API key needed)
- **Nominatim** (geocoding, no API key needed)
