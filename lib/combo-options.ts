import type { ComboCode } from "@/lib/types";

export const comboOptions: Array<{
  code: ComboCode;
  label: string;
  caption: string;
}> = [
  { code: "BIO-CHEM", label: "БИО-ХИМ", caption: "Биология + Химия" },
  { code: "GEO-BIO", label: "ГЕО-БИО", caption: "География + Биология" },
  { code: "GEO-MATH", label: "ГЕО-МАТ", caption: "География + Математика" },
  { code: "GEO-WORLD", label: "ГЕО-ДЖТ", caption: "География + Дүниежүзі тарихы" },
  { code: "WORLD-ENG", label: "ДЖТ-АНГЛ", caption: "Дүниежүзі тарихы + Ағылшын тілі" },
  { code: "GEO-ENG", label: "ГЕО-АНГЛ", caption: "География + Ағылшын тілі" },
  { code: "WORLD-LAW", label: "ДЖТ-ҚҰҚЫҚ", caption: "Дүниежүзі тарихы + Құқық негіздері" },
  { code: "PHYS-MATH", label: "ФИЗ-МАТ", caption: "Физика + Математика" },
  { code: "PHYS-CHEM", label: "ФИЗ-ХИМ", caption: "Физика + Химия" },
  { code: "INFO-MATH", label: "ИНФО-МАТ", caption: "Информатика + Математика" },
  { code: "LIT-LANG", label: "ӘДЕБ-ТІЛ", caption: "Қазақ әдебиеті + Қазақ тілі" },
  { code: "RUSLIT", label: "РУСЛИТ", caption: "Орыс тілі мен әдебиеті" },
  { code: "CREATIVE", label: "ШЫҒАРМАШЫЛЫҚ", caption: "Шығармашылық бағыт" }
];
