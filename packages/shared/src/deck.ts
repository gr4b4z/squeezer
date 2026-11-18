import { z } from 'zod';

/** A slide that is shown but not answered. */
export const ContentSlideSchema = z.object({
  type: z.literal('content'),
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  body: z.string().max(2000).default(''),
});

/** Single-choice question: 2–6 options, exactly one correct. */
export const SingleSlideSchema = z.object({
  type: z.literal('single'),
  id: z.string().min(1).max(64),
  question: z.string().min(1).max(300),
  options: z.array(z.string().min(1).max(80)).min(2).max(6),
  correct: z.number().int().min(0),
  /** Seconds; null = host closes manually. */
  timeLimit: z.number().int().min(10).max(120).nullable().default(20),
  points: z.number().int().min(0).max(5000).default(1000),
  explanation: z.string().max(500).optional(),
});

export const SlideSchema = z.discriminatedUnion('type', [ContentSlideSchema, SingleSlideSchema]);

export const DeckSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,64}$/),
    title: z.string().min(1).max(120),
    description: z.string().max(500).default(''),
    slides: z.array(SlideSchema).min(1).max(200),
  })
  .superRefine((deck, ctx) => {
    const ids = new Set<string>();
    deck.slides.forEach((s, i) => {
      if (ids.has(s.id)) ctx.addIssue({ code: 'custom', path: ['slides', i, 'id'], message: `Duplicate slide id "${s.id}"` });
      ids.add(s.id);
      if (s.type === 'single' && s.correct >= s.options.length) {
        ctx.addIssue({ code: 'custom', path: ['slides', i, 'correct'], message: 'correct must point at one of the options' });
      }
    });
  });

export type ContentSlide = z.infer<typeof ContentSlideSchema>;
export type SingleSlide = z.infer<typeof SingleSlideSchema>;
export type Slide = z.infer<typeof SlideSchema>;
export type Deck = z.infer<typeof DeckSchema>;
