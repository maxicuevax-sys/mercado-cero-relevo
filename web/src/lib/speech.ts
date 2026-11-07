/**
 * Normaliza montos escritos para que el TTS no lea "$50.00" como
 * "cincuenta punto cero cero". Acepta montos con y sin signo de pesos.
 */
export function toSpeechText(text: string): string {
  const spokenAmount = (raw: string): string | null => {
    const [wholeRaw, centsRaw = ""] = raw.replace(/,/g, "").split(".");
    const whole = Number(wholeRaw);
    if (!Number.isFinite(whole)) return null;
    const cents = Number(centsRaw.padEnd(2, "0").slice(0, 2));
    if (!cents) return whole === 0 ? "cero pesos" : `${whole} pesos`;
    if (!whole) return `${cents} centavos`;
    return `${whole} pesos con ${cents} centavos`;
  };

  const withSign = text.replace(
    /\$\s?(\d[\d,]*(?:\.\d{1,2})?)/g,
    (match, raw: string) => spokenAmount(raw) ?? match,
  );

  const withPesos = withSign.replace(
    /\b(\d[\d,]*)\.(\d{2})\s+pesos\b/gi,
    (match, wholeRaw: string, centsRaw: string) =>
      spokenAmount(`${wholeRaw}.${centsRaw}`) ?? match,
  );

  return withPesos.replace(/\s+/g, " ").trim();
}
