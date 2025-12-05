import UnjumbleWord from "./unjumbleWord";

// --- Tipe Data ---
// Interface untuk kata-kata yang akan ditampilkan di area kalimat.
interface SentenceAreaProps {
  /** Array kata-kata yang sudah dipindahkan oleh pemain ke area kalimat. */
  words: { id: number; text: string }[];

  /** Handler yang dipanggil saat kata di area kalimat diklik (untuk mengembalikannya). */
  onWordClick: (id: number) => void;
}

/**
 * @description Komponen yang merepresentasikan area tempat pemain menyusun kalimat.
 * Menggunakan export default untuk kompatibilitas impor di GameUnjumblePage.
 */
export default function SentenceArea({
  words,
  onWordClick,
}: SentenceAreaProps) {
  return (
    <div
      className="border-2 border-dashed border-indigo-400 rounded-lg p-4 min-h-[120px] 
                       flex flex-wrap items-center gap-2 bg-indigo-50/50 transition-all duration-300"
      role="region" // Peran untuk aksesibilitas
      aria-label="Area untuk menyusun kalimat"
    >
      {words.length === 0 ? (
        // Tampilan jika area masih kosong
        <p className="text-gray-500 text-lg italic select-none">
          &nbsp;Klik kata di area 'Pilih Kata-kata' untuk memulai kalimat
          Anda...
        </p>
      ) : (
        // Tampilkan kata-kata yang sudah tersusun
        words.map((word) => (
          <UnjumbleWord
            key={word.id}
            word={word.text}
            onClick={() => onWordClick(word.id)}
            // Set isActive ke true untuk memberikan gaya visual "sudah dipilih/tersusun"
            isActive={true}
          />
        ))
      )}
    </div>
  );
}
