import { Button } from "@/components/ui/button";
import { type MouseEventHandler } from "react";

// --- Interface Props ---
interface UnjumbleWordProps {
  /** Kata yang akan ditampilkan pada tile. */
  word: string;

  /** Handler yang dipanggil saat tile diklik. (Disediakan oleh GameUnjumblePage). */
  onClick: MouseEventHandler<HTMLButtonElement>;

  /** Flag opsional untuk memberikan gaya visual saat kata sudah tersusun (Area Sentence). */
  isActive?: boolean;
}

/**
 * @description Komponen tunggal yang merepresentasikan satu kata (tile)
 * dalam game unjumble. Menggunakan ShadCN Button untuk styling.
 */
export default function UnjumbleWord({
  word,
  onClick,
  isActive = false,
}: UnjumbleWordProps) {
  // Tentukan variant (gaya) tombol berdasarkan status isActive
  // Jika isActive (di area tersusun), gunakan gaya default/primary.
  // Jika tidak isActive (di area acak), gunakan gaya outline.
  const tileVariant = isActive ? "default" : "outline";

  // Tentukan warna latar belakang tambahan untuk membedakan
  const tileClass = isActive
    ? "m-1 p-4 text-base sm:text-lg shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all duration-200"
    : "m-1 p-4 text-base sm:text-lg shadow-md hover:bg-gray-100 transition-all duration-200";

  return (
    <Button
      onClick={onClick}
      // Menggunakan variant ShadCN
      variant={tileVariant}
      // Menggabungkan kelas dari Tailwind dan ShadCN
      className={tileClass}
      style={{
        cursor: "pointer",
        // Tambahkan sedikit transisi untuk efek visual saat diklik/hover
        transform: "scale(1)",
      }}
    >
      {word}
    </Button>
  );
}
