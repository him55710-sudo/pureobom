import { specialValueKinds } from "../core/previewValues";
import type { Lang, Words } from "../core/types";
const meanings: Record<string, Words> = {
  NaN: {
    ko: "NaN: 숫자로 계산되지 않은 결과입니다.",
    en: "NaN: the calculation did not produce a numeric result.",
  },
  Infinity: {
    ko: "Infinity: 유한한 수 범위를 벗어난 양수입니다.",
    en: "Infinity: a positive value beyond the finite number range.",
  },
  "-Infinity": {
    ko: "-Infinity: 유한한 수 범위를 벗어난 음수입니다.",
    en: "-Infinity: a negative value beyond the finite number range.",
  },
  "-0": {
    ko: "-0: 부호가 음수인 0입니다. 나눗셈 등에서 0과 결과가 다를 수 있습니다.",
    en: "-0: zero with a negative sign. Operations such as division can distinguish it from 0.",
  },
  undefined: {
    ko: "undefined: 값이 정해지지 않았습니다. null이나 글자 ‘undefined’와 다릅니다.",
    en: "undefined: a value is not defined. This differs from null and the text ‘undefined’.",
  },
  empty: {
    ko: "<empty>: 목록에서 값 자체가 없는 자리입니다.",
    en: "<empty>: an array position with no value present.",
  },
};
export function PreviewValueHelp({
  values,
  lang,
}: {
  values: unknown[];
  lang: Lang;
}) {
  const kinds = [...new Set(values.flatMap(specialValueKinds))];
  return kinds.length ? (
    <ul
      className="muted"
      aria-label={
        lang === "ko" ? "계산 결과 기호 안내" : "Calculation value guide"
      }
    >
      {kinds.map((kind) => (
        <li key={kind}>{meanings[kind][lang]}</li>
      ))}
    </ul>
  ) : null;
}
