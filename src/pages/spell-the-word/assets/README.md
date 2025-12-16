# Spell the Word - Assets

Folder ini berisi asset gambar untuk game Spell the Word.

## Struktur Folder

```
assets/
├── backgrounds/       # Background images untuk halaman game
│   ├── home.png       # Background untuk halaman home/start
│   ├── game.png       # Background untuk halaman gameplay
│   └── result.png     # Background untuk halaman hasil/score
│
└── buttons/           # Button/UI elements
    ├── start.png      # Tombol Start Game
    ├── submit.png     # Tombol Submit Answer
    ├── skip.png       # Tombol Skip
    ├── play-again.png # Tombol Play Again
    ├── exit.png       # Tombol Exit to Home
    ├── back.png       # Tombol Back
    └── hint.png       # Tombol Hint
```

## Ukuran yang Disarankan

### Backgrounds

- **Resolusi**: 1920x1080 px (Full HD) atau lebih tinggi
- **Format**: PNG atau JPG (PNG untuk transparansi)

### Buttons

- **Ukuran**: Sesuaikan dengan desain, umumnya:
  - Primary buttons (Start, Submit): ~300x80 px
  - Secondary buttons (Skip, Exit): ~200x60 px
  - Icon buttons (Back, Hint): ~50x50 px
- **Format**: PNG dengan transparansi

## Cara Menambahkan Asset

1. Letakkan file gambar di folder yang sesuai
2. Pastikan nama file sesuai dengan yang didefinisikan di atas
3. Asset akan otomatis digunakan oleh komponen game
