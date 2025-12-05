import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import UnjumbleWord from "./unjumbleWord"; // Import komponen Tile kata
import SentenceArea from "./sentence"; // Import komponen Area Kalimat
import { Button } from "@/components/ui/button"; // Asumsi impor ShadCN Button
import { Card, CardHeader, CardContent } from "@/components/ui/card"; // Asumsi impor ShadCN Card

// --- Tipe Data ---
interface Word {
  id: number;
  text: string;
  isShuffled: boolean; // TRUE jika masih di area acak, FALSE jika sudah di area tersusun
}

// --- Data Awal Permainan ---
const INITIAL_WORDS: Word[] = [
  // Contoh dari gambar: "Can she play the violin ?"
  // ID digunakan untuk menjaga urutan asli (untuk validasi akhir) dan juga urutan klik/penyusunan.
  { id: 1, text: "Can", isShuffled: true },
  { id: 2, text: "she", isShuffled: true },
  { id: 3, text: "play", isShuffled: true },
  { id: 4, text: "the", isShuffled: true },
  { id: 5, text: "violin", isShuffled: true },
  { id: 6, text: "?", isShuffled: true },
];

// Kata-kata akan diacak saat ditampilkan, namun state awal ini penting.
const GAME_SLUG = "unjumble-sentence"; // Slug unik untuk game ini

// --- Komponen Utama ---

export default function Unjumble() {
  const navigate = useNavigate();
  const [words, setWords] = useState<Word[]>(
    // Mengacak urutan kata-kata di awal permainan
    [...INITIAL_WORDS].sort(() => Math.random() - 0.5),
  );
  const [isGameActive, setIsGameActive] = useState(true); // Status permainan

  /**
   * @description Menangani pemindahan kata antara area acak dan area tersusun saat diklik.
   * @param id ID unik kata yang diklik.
   */
  const handleWordClick = useCallback(
    (id: number) => {
      if (!isGameActive) return;

      setWords((prevWords) =>
        prevWords.map((word) =>
          word.id === id
            ? { ...word, isShuffled: !word.isShuffled } // Ubah status shuffled
            : word,
        ),
      );
    },
    [isGameActive],
  );

  /**
   * @description Mengirim POST request ke backend lokal untuk menambah play count dan menavigasi ke Home.
   */
  const handleExitGame = useCallback(async () => {
    setIsGameActive(false); // Nonaktifkan interaksi game saat proses keluar

    // 1. POST Request ke Backend Lokal (Simulasi)
    try {
      // URL ini harus sesuai dengan endpoint backend lokal Anda
      await fetch("http://localhost:3001/api/game/increment-playcount", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameSlug: GAME_SLUG,
          userId: "current_user_id",
        }),
        // Asumsi backend membutuhkan gameSlug dan/atau userId
      });
      console.log(
        `POST Request berhasil: Play count untuk ${GAME_SLUG} bertambah.`,
      );
    } catch (error) {
      console.error("Gagal mengirim play count:", error);
      // Penting: Walaupun gagal, tetap lanjutkan navigasi
    }

    // 2. Arahkan ke Home Page
    navigate("/");
  }, [navigate]);

  // Filter kata untuk ditampilkan di masing-masing area
  const shuffledWords = words.filter((w) => w.isShuffled);

  // Kata tersusun diurutkan berdasarkan ID, yang secara implisit adalah urutan klik/penyusunan
  const sortedSentenceWords = words.filter((w) => !w.isShuffled);

  // --- Logika Validasi (Opsional untuk Full Code) ---
  // Di sini Anda bisa menambahkan logika untuk mengecek apakah kalimat sudah benar.
  // Misal: Cek jika jumlah sortedSentenceWords sama dengan jumlah total dan urutan text-nya benar.

  return (
    <div className="flex flex-col min-h-screen p-4 bg-gray-100">
      <header className="flex justify-between items-center p-4 bg-white shadow-md rounded-lg mb-6">
        <h1 className="text-3xl font-bold text-indigo-700">
          🧩 Unjumble Sentence
        </h1>
        <div className="flex items-center space-x-4">
          {/* Placeholder untuk Timer/Skor */}
          <span className="text-xl font-medium text-gray-600">Time: 0:58</span>

          {/* Tombol Exit Wajib */}
          <Button
            variant="destructive"
            onClick={handleExitGame}
            disabled={!isGameActive}
            className="shadow-lg"
          >
            Keluar & Home
          </Button>
        </div>
      </header>

      <main className="grow space-y-8">
        {/* --- Area Kalimat Tersusun --- */}
        <Card className="p-6">
          <CardHeader>
            <h2 className="text-xl font-semibold mb-2">
              Susun Kalimat di Bawah Ini:
            </h2>
          </CardHeader>
          <CardContent>
            <SentenceArea
              words={sortedSentenceWords}
              onWordClick={handleWordClick}
            />
          </CardContent>
        </Card>

        {/* --- Area Kata Acak --- */}
        <Card className="p-6">
          <CardHeader>
            <h2 className="text-xl font-semibold mb-2">Pilih Kata-kata:</h2>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 justify-center">
            {shuffledWords.map((word) => (
              <UnjumbleWord
                key={word.id}
                word={word.text}
                onClick={() => handleWordClick(word.id)}
              />
            ))}
          </CardContent>
        </Card>
      </main>

      <footer className="mt-6 text-center text-gray-500">
        <p>Proyek Pemrograman Web - Template Game Unjumble</p>
      </footer>
    </div>
  );
}
