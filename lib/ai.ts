import { generateText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export const extractionSchema = z.object({
  category: z.enum([
    'delay',
    'damage',
    'missed delivery',
    'general question',
    'compliment',
    'other',
  ]),
  priority: z.enum(['high', 'medium', 'low']),
  summary: z
    .string()
    .describe('One sentence describing what the customer wants'),
  location: z
    .string()
    .nullable()
    .describe('Postcode or city mentioned in the message, or null if none'),
  language: z.enum(['dutch', 'english', 'other']),
  sentiment: z.enum(['frustrated', 'neutral', 'positive']),
  suggested_reply: z
    .string()
    .nullable()
    .describe('A short, friendly draft reply ONLY if category is general question. null otherwise.'),
});

export type ExtractedData = z.infer<typeof extractionSchema>;

export async function extractMessageData(message: string): Promise<ExtractedData> {
  const result = await generateText({
    model: openai('gpt-4o-mini'),
    output: Output.object({ schema: extractionSchema }),
    prompt: `You are a customer service classifier for Snelpost, a parcel delivery company in the Netherlands.
 
     Analyze the following customer message and extract structured data.
 
    Rules:
    - category: Choose the single best fit. "missed delivery" means the parcel never arrived. "delay" means it's late but might still come. "damage" means the parcel or contents were damaged. "compliment" means the customer is expressing satisfaction or praise about the service, driver, or delivery. "general question" means the customer is asking for information. Use "other" only if none of the above fit.
    - priority: "high" for angry customers, missing parcels 2+ days, or damaged goods. "medium" for delays or unclear situations. "low" for general questions and compliments.
    - summary: One clear sentence.
    - location: Extract any postcode (e.g. "3521AL") or city name. null if none mentioned.
    - language: Detect the language of the message. Classify as "dutch", "english", or "other".
    - sentiment: "frustrated" if the customer sounds angry, upset, or uses exclamation marks/strong language. "positive" for happy messages. "neutral" otherwise.
    - suggested_reply: ONLY generate a short, friendly reply if category is "general question". Set to null for all other categories.
 
    Customer message: '${message}'`
  });

  return result.output;
}