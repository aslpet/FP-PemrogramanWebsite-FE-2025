import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import Dropzone from "@/components/ui/dropzone";
import { Typography } from "@/components/ui/typography";
import { ArrowLeft, Plus, Save, Eye, Trash2 } from "lucide-react";
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

// Interface baru untuk menangani data raw dari API
interface ApiCrosswordItem {
  word?: string;
  clue?: string;
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

  const [items, setItems] = useState<CrosswordItem[]>([{ word: "", clue: "" }]);

  // Fetch Existing Data
  useEffect(() => {
    const fetchGame = async () => {
      try {
        const response = await api.get(`/api/game/game-type/crossword/${id}`);
        const data = response.data.data;

        setTitle(data.name || "");
        setDescription(data.description || "");
        setIsPublish(!!data.is_published);

        if (data.thumbnail_image) {
          setThumbnailPreview(
            `${import.meta.env.VITE_API_URL}/${data.thumbnail_image}`,
          );
        }

        const fetchedItems = data.items || data.game_json?.items || [];

        if (fetchedItems.length > 0) {
          // Menggunakan tipe ApiCrosswordItem menggantikan any
          setItems(
            fetchedItems.map((i: ApiCrosswordItem) => ({
              word: i.word || "",
              clue: i.clue || "",
            })),
          );
        } else {
          setItems(Array(5).fill({ word: "", clue: "" }));
        }
      } catch (error) {
        console.error("Failed to fetch game:", error);
        toast.error("Failed to load game data");
        navigate("/my-projects");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchGame();
  }, [id, navigate]);

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

    const validItems = items.filter(
      (i) => i.word.length >= 2 && i.clue.length >= 3,
    );
    if (validItems.length < 5)
      return toast.error("Please provide at least 5 valid words and clues");

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("name", title);
      formData.append("description", description);
      formData.append("is_publish", String(publishStatus));

      if (thumbnail) {
        formData.append("thumbnail_image", thumbnail);
      }

      formData.append("items", JSON.stringify(validItems));

      await api.patch(`/api/game/game-type/crossword/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(
        `Crossword ${publishStatus ? "published" : "saved"} successfully!`,
      );
      navigate("/my-projects");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update game");
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
                <div className="flex-[2]">
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
