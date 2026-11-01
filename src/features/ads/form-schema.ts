import { z } from "zod";
import {
  AD_PLATFORMS,
  isCalendarDay,
  parseLibraryAdId,
  parseProductLink,
} from "./domain/ads";

const MAX_ADVERTISER_LENGTH = 100;
const MAX_AD_TEXT_LENGTH = 2000;

/**
 * What the admin types when curating an ad, checked on the server. The pasted links are turned
 * into the ad id and the product reference here, so nothing else ever stores the raw text.
 */
export const adFormSchema = z.object({
  libraryLink: z.string().transform((value, context) => {
    const id = parseLibraryAdId(value);

    if (id != null) return id;

    context.addIssue({
      code: "custom",
      message:
        "Cole o link do anúncio na biblioteca da Meta (com ?id= no final).",
    });

    return z.NEVER;
  }),
  advertiserName: z
    .string()
    .trim()
    .min(1, { error: "Digite quem anuncia." })
    .max(MAX_ADVERTISER_LENGTH, { error: "Use no máximo 100 letras." }),
  adText: z
    .string()
    .trim()
    .max(MAX_AD_TEXT_LENGTH, { error: "Use no máximo 2.000 letras." }),
  platforms: z
    .array(z.enum(AD_PLATFORMS))
    .min(1, { error: "Marque pelo menos um lugar onde o anúncio aparece." })
    .transform((platforms) => [...new Set(platforms)]),
  startedOn: z.string().refine(isCalendarDay, {
    error: "Escolha a data em que o anúncio começou.",
  }),
  productLink: z
    .string()
    .trim()
    .transform((value, context) => {
      if (value.length === 0) return null;

      const link = parseProductLink(value);

      if (link != null) return link;

      context.addIssue({
        code: "custom",
        message: "Use o link da ficha do Radar ou o link do produto na Shopee.",
      });

      return z.NEVER;
    }),
});

export type AdFormInput = z.input<typeof adFormSchema>;
export type AdFormData = z.output<typeof adFormSchema>;
export type AdFormField = keyof AdFormInput;
export type AdFieldErrors = Partial<Record<AdFormField, string>>;

/** First message per field, ready to show under each input. */
export function toAdFieldErrors(error: z.ZodError): AdFieldErrors {
  const entries = error.issues
    .filter((issue) => issue.path.length > 0)
    .map((issue) => [String(issue.path[0]), issue.message] as const);

  return Object.fromEntries(entries.toReversed()) as AdFieldErrors;
}
