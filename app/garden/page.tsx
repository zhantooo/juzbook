import { Handjet } from "next/font/google";
import { GardenPage } from "@/components/garden/garden-page";

// Пиксель бақтың қарпі — тек осы бетте қолданылады.
const handjet = Handjet({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-garden-pixel",
  display: "swap"
});

export default function Page() {
  return <GardenPage fontClassName={handjet.variable} />;
}
