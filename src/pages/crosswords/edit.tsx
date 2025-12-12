import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import Dropzone from "@/components/ui/dropzone";
import { Typography } from "@/components/ui/typography";
import {
  ArrowLeft,
  Plus,
  Save,
  Eye,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import api from "@/api/axios";

interface CrosswordItem {
  word: string;
  clue: string;
}

export default function EditCrossword() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [isPublish, setIsPublish] = useState(false);

  // Items kita kosongkan karena Backend tidak mengembalikan data 'answer'
  const [items, setItems] = useState<CrosswordItem[]>([]);
  // Mode edit words hanya aktif jika user memilih untuk overwrite
  const [isEditingWords, setIsEditingWords] = useState(false);

  useEffect(() => {
    const fetchGame = async () => {
      try {
        // ALIGNMENT BACKEND: Gunakan /play/private karena endpoint detail tidak ada
        const response = await api.get(
          `/api/game/game-type/crossword/${id}/play/private`,
        );
        const data = response.data.data;

        setTitle(data.name || "");
        setDescription(data.description || "");
        setIsPublish(!!data.is_published);

        if (data.thumbnail_image) {
          setThumbnailPreview(
            `${import.meta.env.VITE_API_URL}/${data.thumbnail_image}`,
          );
        }

        // Kita TIDAK me-load words ke state 'items' karena field 'answer' tidak ada.
      } catch (error) {
        console.error("Failed to fetch game:", error);
        toast.error("Failed to load game data.");
        navigate("/my-projects");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchGame();
  }, [id, navigate]);

  const handleStartEditingWords = () => {
    setIsEditingWords(true);
    setItems([
      { word: "", clue: "" },
      { word: "", clue: "" },
      { word: "", clue: "" },
      { word: "", clue: "" },
      { word: "", clue: "" },
    ]);
  };

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

  const handleThumbnailChange = (file: File | null) => {
    setThumbnail(file);
    if (file) setThumbnailPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (publishStatus: boolean) => {
    if (!title.trim()) return toast.error("Title is required");
    if (!thumbnail && !thumbnailPreview)
      return toast.error("Thumbnail is required");

    let validWords: { word: string; clue: string }[] = [];
    if (isEditingWords) {
      validWords = items.filter(
        (i) => i.word.trim().length >= 2 && i.clue.trim().length >= 3,
      );
      if (validWords.length < 5)
        return toast.error("Please provide at least 5 valid words and clues");
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("name", title);
      formData.append("description", description);
      // ALIGNMENT BACKEND: Field update publish menggunakan 'is_publish' (string)
      formData.append("is_publish", publishStatus ? "true" : "false");

      if (thumbnail) {
        formData.append("thumbnail_image", thumbnail);
      }

      // Hanya kirim update Grid jika user memilih edit words
      if (isEditingWords) {
        const formattedWords = validWords.map((item, index) => ({
          number: index + 1,
          direction: "horizontal",
          row_index: index * 2,
          col_index: 0,
          answer: item.word.toUpperCase(),
          clue: item.clue,
        }));

        formData.append("words", JSON.stringify(formattedWords));
        const minRows = formattedWords.length * 2 + 5;
        formData.append("rows", String(minRows > 20 ? minRows : 20));
        formData.append("cols", "20");
      }

      await api.patch(`/api/game/game-type/crossword/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(
        `Crossword ${publishStatus ? "published" : "saved"} successfully!`,
      );
      navigate("/my-projects");
    } catch (err: unknown) {
      console.error(err);
      const errorObj = err as { response?: { data?: { message?: string } } };
      const msg = errorObj?.response?.data?.message || "Failed to update game";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );

  return (
    <div className="w-full bg-slate-50 min-h-screen flex flex-col p-8">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/my-projects")}
          className="pl-0"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <Typography variant="h3">Edit Crossword</Typography>

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

          <Dropzone
            label="Thumbnail"
            required={!thumbnailPreview}
            onChange={handleThumbnailChange}
            defaultValue={thumbnailPreview}
          />
        </div>

        <div className="bg-white p-6 rounded-xl border space-y-4">
          <div className="flex justify-between items-center">
            <Typography variant="h4">Words & Clues</Typography>
            {isEditingWords && (
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="mr-2 h-4 w-4" /> Add Word
              </Button>
            )}
          </div>

          {!isEditingWords ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-amber-800 font-semibold">
                <AlertTriangle className="h-5 w-5" />
                <span>Words are hidden</span>
              </div>
              <p className="text-sm text-amber-700">
                Existing crossword data is hidden by the server for security
                reasons. You can update the Title/Description/Thumbnail without
                changing the game content.
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="w-fit mt-2"
                onClick={handleStartEditingWords}
              >
                Overwrite with New Words
              </Button>
            </div>
          ) : (
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
          )}
        </div>

        <div className="flex justify-end gap-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Cancel</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to cancel? Unsaved changes will be lost.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Editing</AlertDialogCancel>
                <AlertDialogAction onClick={() => navigate("/my-projects")}>
                  Discard
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
          >
            <Save className="mr-2 h-4 w-4" /> Save Draft
          </Button>
          <Button onClick={() => handleSubmit(true)} disabled={isSubmitting}>
            <Eye className="mr-2 h-4 w-4" />{" "}
            {isPublish ? "Update & Publish" : "Publish"}
          </Button>
        </div>
      </div>
    </div>
  );
}
