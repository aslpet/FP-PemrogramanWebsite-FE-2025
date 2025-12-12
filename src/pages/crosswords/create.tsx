import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import Dropzone from "@/components/ui/dropzone";
import { Typography } from "@/components/ui/typography";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import api from "@/api/axios";

interface CrosswordItem {
  word: string;
  clue: string;
}

export default function CreateCrossword() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [items, setItems] = useState<CrosswordItem[]>([
    { word: "", clue: "" },
    { word: "", clue: "" },
    { word: "", clue: "" },
    { word: "", clue: "" },
    { word: "", clue: "" },
  ]);

  const addItem = () => setItems([...items, { word: "", clue: "" }]);

  const removeItem = (index: number) => {
    if (items.length > 5) setItems(items.filter((_, i) => i !== index));
    else toast.error("Minimum 5 words required");
  };

  const handleItemChange = (
    index: number,
    field: "word" | "clue",
    value: string,
  ) => {
    const newItems = [...items];
    newItems[index][field] =
      field === "word" ? value.toUpperCase().replace(/[^A-Z]/g, "") : value;
    setItems(newItems);
  };

  const handleSubmit = async (publish = false) => {
    if (!thumbnail) return toast.error("Thumbnail is required");
    if (!title.trim()) return toast.error("Title is required");

    const validRawItems = items.filter(
      (i) => i.word.trim().length >= 2 && i.clue.trim().length >= 3,
    );

    if (validRawItems.length < 5)
      return toast.error("Please provide at least 5 valid words and clues");

    // ALIGNMENT BACKEND: Generate Struktur Grid Manual (Dummy Layout)
    const formattedWords = validRawItems.map((item, index) => ({
      number: index + 1, // Nomor soal (Required BE)
      direction: "horizontal", // Arah (Required BE)
      row_index: index * 2, // Baris (Kasih jarak 2 baris biar ga tabrakan)
      col_index: 0, // Kolom (Rata kiri)
      answer: item.word.toUpperCase(), // Nama field wajib 'answer'
      clue: item.clue,
    }));

    const formData = new FormData();
    formData.append("name", title);
    formData.append("description", description);
    formData.append("thumbnail_image", thumbnail);
    formData.append("is_publish_immediately", publish ? "true" : "false");

    // Kirim data words dalam bentuk string JSON
    formData.append("words", JSON.stringify(formattedWords));

    // Kirim ukuran grid (rows & cols) yang cukup muat
    const minRows = formattedWords.length * 2 + 5;
    formData.append("rows", String(minRows > 20 ? minRows : 20));
    formData.append("cols", "20");

    try {
      await api.post("/api/game/game-type/crossword", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Crossword created successfully!");
      navigate("/my-projects");
    } catch (err: unknown) {
      console.error(err);
      // Type casting error agar aman dari linter
      const errorObj = err as { response?: { data?: { message?: string } } };
      const msg = errorObj?.response?.data?.message || "Failed to create game";
      toast.error(msg);
    }
  };

  return (
    <div className="w-full bg-slate-50 min-h-screen flex flex-col p-8">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/create-projects")}
          className="pl-0"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <Typography variant="h3">Create Crossword</Typography>

        <div className="bg-white p-6 rounded-xl border space-y-6">
          <FormField
            label="Game Title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div className="grid w-full items-center gap-1.5">
            <Label>Description</Label>
            <Textarea
              className="bg-[#F3F3F5]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Game description..."
            />
          </div>

          <Dropzone label="Thumbnail" required onChange={setThumbnail} />
        </div>

        <div className="bg-white p-6 rounded-xl border space-y-4">
          <div className="flex justify-between items-center">
            <Typography variant="h4">Words & Clues</Typography>
            <Button size="sm" variant="outline" onClick={addItem}>
              <Plus className="mr-2 h-4 w-4" /> Add Word
            </Button>
          </div>
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="flex gap-4 items-end border-b pb-4 last:border-0"
              >
                <div className="flex-1">
                  <Label>Word (Answer)</Label>
                  <input
                    className="w-full border rounded-md px-3 py-2 mt-1 uppercase text-sm bg-slate-50"
                    value={item.word}
                    onChange={(e) =>
                      handleItemChange(idx, "word", e.target.value)
                    }
                    placeholder="e.g. REACT"
                  />
                </div>
                <div className="flex-2">
                  <Label>Clue (Question)</Label>
                  <input
                    className="w-full border rounded-md px-3 py-2 mt-1 text-sm bg-slate-50"
                    value={item.clue}
                    onChange={(e) =>
                      handleItemChange(idx, "clue", e.target.value)
                    }
                    placeholder="e.g. A JavaScript Library"
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-red-500 shrink-0"
                  onClick={() => removeItem(idx)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => handleSubmit(false)}>
            Save Draft
          </Button>
          <Button onClick={() => handleSubmit(true)}>Publish</Button>
        </div>
      </div>
    </div>
  );
}
