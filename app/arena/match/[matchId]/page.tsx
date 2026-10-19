import type { Metadata } from "next";
import { ArenaMatchPage } from "@/components/arena/arena-match-page";

export const metadata: Metadata = {
  title: "Жекпе-жек | JUZBOOK"
};

export const dynamic = "force-dynamic";

/**
 * Матч беті.
 *
 * Матч жеке мекенжайда тұрады: сілтемені жаңартсаң да сол матчқа қайтасың,
 * ал екі ойыншы бір матчты өз бетінен көреді.
 */
export default async function ArenaMatchRoute({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return <ArenaMatchPage matchId={matchId} />;
}
