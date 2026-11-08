import type { AdSource } from "./ad-source";

/**
 * The automatic ad source the scheduled collection uses, or null while there is none.
 *
 * @remarks
 * There is no real source yet: a supplier or an automatic collector of the Meta ad library plugs
 * in here once the client picks one. The sample source never runs here, so made-up ads never
 * reach the people who use the app; it stays for local machines, the seed and the tests.
 *
 * @returns The source to collect from, or null when no automatic source is configured.
 */
export function selectAdSource(): AdSource | null {
  return null;
}
