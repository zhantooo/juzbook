/**
 * Суретті CSS арқылы қию.
 *
 * Жаңа файл жасалмайды: түпнұсқа сурет орнында қалады да, тек оның қай
 * бөлігі көрінетіні жазылады. Себептері:
 *
 * - Оқулық суреттері сыртқы қоймада (R2) тұр, ал оған жазу үшін кілт керек.
 *   CSS қиюы мазмұнмен бірге деплой болады да, қойманы мүлде қажет етпейді.
 * - Түпнұсқа бүлінбейді, сондықтан қиюды кейін қайта реттеуге немесе мүлде
 *   алып тастауға болады.
 *
 * Қалай жұмыс істейді: сурет орауыштан (`overflow:hidden`) үлкенірек етіп
 * созылады да, теріс жиекпен (margin) ығыстырылады. Артығы қиылып қалады.
 * Орауыштың биіктігі теріс жиектің әсерінен өзі дұрыс мәнге жиналады.
 *
 * НАЗАР: CSS-те жиектің пайызы — әрқашан контейнердің ЕНІНЕ қатысты, тіпті
 * жоғарғы-төменгісі де. Сондықтан тік жақтарын есептегенде суреттің өз
 * арақатынасына (биіктік ÷ ен) көбейтеміз.
 */

/** Төрт жақтан қиылатын үлес (0–1) және суреттің биіктік ÷ ен арақатынасы */
export type ImageCrop = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** биіктік ÷ ен (түпнұсқа суреттікі) */
  ratio: number;
};

/** Мазмұнда сақталатын атрибуттың аты */
export const CROP_ATTRIBUTE = "data-juz-crop";

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

/** `"0.1,0.05,0.1,0.2,0.75"` → ImageCrop. Жарамсыз болса — null. */
export function parseCrop(value: string | null | undefined): ImageCrop | null {
  if (!value) {
    return null;
  }

  const parts = value.split(",").map((piece) => Number.parseFloat(piece.trim()));
  if (parts.length !== 5 || parts.some((piece) => !Number.isFinite(piece))) {
    return null;
  }

  const [left, top, right, bottom, ratio] = parts;
  const crop: ImageCrop = {
    left: clamp01(left),
    top: clamp01(top),
    right: clamp01(right),
    bottom: clamp01(bottom),
    ratio: ratio > 0 ? ratio : 1
  };

  // Ештеңе қалмайтын немесе ештеңе қиылмайтын мән мағынасыз.
  if (crop.left + crop.right >= 0.95 || crop.top + crop.bottom >= 0.95) {
    return null;
  }
  if (crop.left + crop.top + crop.right + crop.bottom < 0.005) {
    return null;
  }

  return crop;
}

export function formatCrop(crop: ImageCrop): string {
  const round = (value: number) => Number(value.toFixed(4));
  return [round(crop.left), round(crop.top), round(crop.right), round(crop.bottom), round(crop.ratio)].join(",");
}

/** Орауыш пен суреттің CSS мәндері */
export function cropStyles(crop: ImageCrop) {
  const keptWidth = 1 - crop.left - crop.right;
  const percent = (value: number) => `${Number((value * 100).toFixed(4))}%`;

  return {
    // Орауыш: артығын қиып тастайды. `line-height:0` — суреттің астындағы
    // мәтін жолының бос орны қалмауы үшін.
    wrapper: "display:block;overflow:hidden;line-height:0;max-width:100%;",
    image: [
      "display:block",
      `width:${percent(1 / keptWidth)}`,
      "max-width:none",
      "height:auto",
      `margin-left:${percent(-crop.left / keptWidth)}`,
      // Тік жақтары ЕНГЕ қатысты есептеледі, сондықтан арақатынасқа көбейтілді.
      `margin-top:${percent((-crop.top * crop.ratio) / keptWidth)}`,
      `margin-bottom:${percent((-crop.bottom * crop.ratio) / keptWidth)}`
    ].join(";")
  };
}
