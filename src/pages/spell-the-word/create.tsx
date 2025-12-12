import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/api/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Typography } from "@/components/ui/typography";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Image,
  Volume2,
  Upload,
  X,
} from "lucide-react";

// --- TYPE DEFINITIONS ---
interface WordItem {
  word_index: number;
  word_text: string;
  word_image: File | null;
  word_image_preview: string | null; // Full URL for display
  word_image_path: string | null; // Backend path for update
  word_audio: File | null;
  word_audio_name: string | null;
  word_audio_url: string | null; // Full audio path for edit mode
  hint: string;
}

interface GameFormData {
  name: string;
  description: string;
  thumbnail_image: File | null;
  thumbnail_preview: string | null;
  words: WordItem[];
  time_limit: number;
  score_per_word: number;
}

// --- WORD ITEM COMPONENT ---
const WordItemCard = ({
  word,
  index,
  onUpdateText,
  onUpdateImage,
  onUpdateAudio,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  word: WordItem;
  index: number;
  onUpdateText: (
    index: number,
    field: "word_text" | "hint",
    value: string,
  ) => void;
  onUpdateImage: (index: number, file: File | null) => void;
  onUpdateAudio: (index: number, file: File | null) => void;
  onDelete: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  isFirst: boolean;
  isLast: boolean;
}) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Drag Handle & Order */}
        <div className="flex flex-col items-center gap-1 pt-2">
          <GripVertical className="w-5 h-5 text-slate-400 cursor-grab" />
          <span className="text-xs text-slate-500 font-medium">
            #{index + 1}
          </span>
          <div className="flex flex-col gap-1 mt-2">
            <button
              onClick={() => onMoveUp(index)}
              disabled={isFirst}
              className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
              title="Move up"
            >
              ↑
            </button>
            <button
              onClick={() => onMoveDown(index)}
              disabled={isLast}
              className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
              title="Move down"
            >
              ↓
            </button>
          </div>
        </div>

        {/* Word Content */}
        <div className="flex-1 space-y-4">
          {/* Word and Hint Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`word-${index}`} className="text-sm font-medium">
                Word <span className="text-red-500">*</span>
              </Label>
              <Input
                id={`word-${index}`}
                value={word.word_text}
                onChange={(e) =>
                  onUpdateText(index, "word_text", e.target.value)
                }
                placeholder="Enter word to spell"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor={`hint-${index}`} className="text-sm font-medium">
                Hint (Optional)
              </Label>
              <Input
                id={`hint-${index}`}
                value={word.hint}
                onChange={(e) => onUpdateText(index, "hint", e.target.value)}
                placeholder="Enter a hint for the word"
                className="mt-1"
              />
            </div>
          </div>

          {/* Image and Audio Upload Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Image Upload */}
            <div>
              <Label className="text-sm font-medium flex items-center gap-1">
                <Image className="w-4 h-4" /> Image{" "}
                <span className="text-red-500">*</span>
              </Label>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  onUpdateImage(index, file);
                }}
              />
              {word.word_image_preview ? (
                <div className="mt-1 relative">
                  <img
                    src={word.word_image_preview}
                    alt="Preview"
                    className="w-full h-24 object-cover rounded-lg border"
                  />
                  <button
                    onClick={() => onUpdateImage(index, null)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="mt-1 w-full h-24 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-purple-400 hover:text-purple-500 transition-colors"
                >
                  <Upload className="w-6 h-6 mb-1" />
                  <span className="text-xs">Upload Image</span>
                </button>
              )}
            </div>

            {/* Audio Upload */}
            <div>
              <Label className="text-sm font-medium flex items-center gap-1">
                <Volume2 className="w-4 h-4" /> Audio (Optional)
              </Label>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  onUpdateAudio(index, file);
                }}
              />
              {word.word_audio_name ? (
                <div className="mt-1 flex items-center gap-2 p-3 bg-slate-100 rounded-lg">
                  <Volume2 className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600 flex-1 truncate">
                    {word.word_audio_name}
                  </span>
                  <button
                    onClick={() => onUpdateAudio(index, null)}
                    className="p-1 text-red-500 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => audioInputRef.current?.click()}
                  className="mt-1 w-full h-24 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-purple-400 hover:text-purple-500 transition-colors"
                >
                  <Upload className="w-6 h-6 mb-1" />
                  <span className="text-xs">Upload Audio</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Delete Button */}
        <button
          onClick={() => onDelete(index)}
          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          title="Delete word"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// --- CREATE/EDIT FORM COMPONENT ---
const CreateSpellTheWord = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<GameFormData>({
    name: "",
    description: "",
    thumbnail_image: null,
    thumbnail_preview: null,
    words: [
      {
        word_index: 0,
        word_text: "",
        word_image: null,
        word_image_preview: null,
        word_image_path: null,
        word_audio: null,
        word_audio_name: null,
        word_audio_url: null,
        hint: "",
      },
    ],
    time_limit: 30,
    score_per_word: 100,
  });

  // Fetch existing game data if editing
  useEffect(() => {
    if (isEditMode && id) {
      const fetchGame = async () => {
        try {
          setIsLoading(true);
          const response = await api.get(
            `/api/game/game-type/spell-the-word/${id}`,
          );
          const data = response.data.data;
          const gameJson = data.game_json || {};

          // Map words from backend
          const words = (gameJson.words || []).map(
            (
              w: {
                word_text: string;
                word_image: string | null;
                word_audio: string | null;
                hint: string;
              },
              i: number,
            ) => ({
              word_index: i,
              word_text: w.word_text || "",
              word_image: null,
              word_image_preview: w.word_image
                ? `${import.meta.env.VITE_API_URL}/${w.word_image}`
                : null,
              word_image_path: w.word_image || null, // Store backend path for update
              word_audio: null,
              word_audio_name: w.word_audio
                ? w.word_audio.split("/").pop()
                : null,
              word_audio_url: w.word_audio || null, // Store full path for update
              hint: w.hint || "",
            }),
          );

          setFormData({
            name: data.name || "",
            description: data.description || "",
            thumbnail_image: null,
            thumbnail_preview: data.thumbnail_image
              ? `${import.meta.env.VITE_API_URL}/${data.thumbnail_image}`
              : null,
            words:
              words.length > 0
                ? words
                : [
                    {
                      word_index: 0,
                      word_text: "",
                      word_image: null,
                      word_image_preview: null,
                      word_image_path: null,
                      word_audio: null,
                      word_audio_name: null,
                      word_audio_url: null,
                      hint: "",
                    },
                  ],
            time_limit: gameJson.time_limit || 30,
            score_per_word: gameJson.score_per_word || 100,
          });
        } catch (error) {
          console.error("Failed to fetch game:", error);
          toast.error("Failed to load game data");
        } finally {
          setIsLoading(false);
        }
      };
      fetchGame();
    }
  }, [id, isEditMode]);

  // Update form field
  const updateField = <K extends keyof GameFormData>(
    field: K,
    value: GameFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Update word text
  const updateWordText = (
    index: number,
    field: "word_text" | "hint",
    value: string,
  ) => {
    const newWords = [...formData.words];
    newWords[index][field] = value;
    updateField("words", newWords);
  };

  // Update word image
  const updateWordImage = (index: number, file: File | null) => {
    const newWords = [...formData.words];
    newWords[index].word_image = file;
    newWords[index].word_image_preview = file
      ? URL.createObjectURL(file)
      : null;
    updateField("words", newWords);
  };

  // Update word audio
  const updateWordAudio = (index: number, file: File | null) => {
    const newWords = [...formData.words];
    newWords[index].word_audio = file;
    newWords[index].word_audio_name = file ? file.name : null;
    updateField("words", newWords);
  };

  // Handle thumbnail
  const handleThumbnailChange = (file: File | null) => {
    updateField("thumbnail_image", file);
    updateField("thumbnail_preview", file ? URL.createObjectURL(file) : null);
  };

  // Add new word
  const addWord = () => {
    const newWord: WordItem = {
      word_index: formData.words.length,
      word_text: "",
      word_image: null,
      word_image_preview: null,
      word_image_path: null,
      word_audio: null,
      word_audio_name: null,
      word_audio_url: null,
      hint: "",
    };
    updateField("words", [...formData.words, newWord]);
  };

  // Delete word
  const deleteWord = (index: number) => {
    if (formData.words.length <= 1) {
      toast.error("You need at least one word");
      return;
    }
    const newWords = formData.words
      .filter((_, i) => i !== index)
      .map((word, i) => ({ ...word, word_index: i }));
    updateField("words", newWords);
  };

  // Move word up
  const moveWordUp = (index: number) => {
    if (index === 0) return;
    const newWords = [...formData.words];
    [newWords[index - 1], newWords[index]] = [
      newWords[index],
      newWords[index - 1],
    ];
    newWords.forEach((word, i) => (word.word_index = i));
    updateField("words", newWords);
  };

  // Move word down
  const moveWordDown = (index: number) => {
    if (index === formData.words.length - 1) return;
    const newWords = [...formData.words];
    [newWords[index], newWords[index + 1]] = [
      newWords[index + 1],
      newWords[index],
    ];
    newWords.forEach((word, i) => (word.word_index = i));
    updateField("words", newWords);
  };

  // Validate form
  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      toast.error("Please enter a game name");
      return false;
    }

    if (!formData.thumbnail_image && !formData.thumbnail_preview) {
      toast.error("Please upload a thumbnail image");
      return false;
    }

    const validWords = formData.words.filter((w) => w.word_text.trim());
    if (validWords.length < 1) {
      toast.error("Please add at least one word");
      return false;
    }

    for (const word of validWords) {
      if (!/^[a-zA-Z]+$/.test(word.word_text.trim())) {
        toast.error(`Word "${word.word_text}" should only contain letters`);
        return false;
      }
      if (!word.word_image && !word.word_image_preview) {
        toast.error(`Word "${word.word_text}" must have an image`);
        return false;
      }
    }

    return true;
  };

  // Submit form
  const handleSubmit = async (publish: boolean = false) => {
    if (!validateForm()) return;

    try {
      setIsSaving(true);

      const validWords = formData.words.filter((w) => w.word_text.trim());

      // Create FormData for multipart upload
      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name.trim());
      formDataToSend.append("description", formData.description.trim());
      formDataToSend.append("is_publish_immediately", String(publish));
      formDataToSend.append("score_per_word", String(formData.score_per_word));
      formDataToSend.append("time_limit", String(formData.time_limit));

      // Add thumbnail if new
      if (formData.thumbnail_image) {
        formDataToSend.append("thumbnail_image", formData.thumbnail_image);
      }

      // Calculate proper indices for files - track actual file upload order
      let imageFileIndex = 0;
      let audioFileIndex = 0;

      // Prepare words data with correct file indices
      const wordsData = validWords.map((word) => {
        const wordData: {
          word_text: string;
          word_image_array_index?: number | string;
          word_audio_array_index?: number | string;
          hint?: string;
        } = {
          word_text: word.word_text.toLowerCase().trim(),
          hint: word.hint || undefined,
        };

        // For image: if there's a new file, use the current image index; if only path (edit mode), use the path
        if (word.word_image) {
          wordData.word_image_array_index = imageFileIndex++;
        } else if (word.word_image_path) {
          // Edit mode: existing image path (backend path, not full URL)
          wordData.word_image_array_index = word.word_image_path;
        }

        // For audio: if there's a new file, use the current audio index; if only existing URL (edit mode), use the path
        if (word.word_audio) {
          wordData.word_audio_array_index = audioFileIndex++;
        } else if (word.word_audio_url) {
          // Edit mode: existing audio path
          wordData.word_audio_array_index = word.word_audio_url;
        }

        return wordData;
      });

      formDataToSend.append("words", JSON.stringify(wordsData));

      // Add image files (in order)
      validWords.forEach((word) => {
        if (word.word_image) {
          formDataToSend.append("files_to_upload", word.word_image);
        }
      });

      // Add audio files (in order)
      validWords.forEach((word) => {
        if (word.word_audio) {
          formDataToSend.append("audio_files", word.word_audio);
        }
      });

      if (isEditMode) {
        await api.patch(
          `/api/game/game-type/spell-the-word/${id}`,
          formDataToSend,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );
        toast.success("Game updated successfully!");
      } else {
        await api.post("/api/game/game-type/spell-the-word", formDataToSend, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Game created successfully!");
      }

      navigate("/my-projects");
    } catch (error) {
      console.error("Failed to save game:", error);
      // Extract error message from axios response if available
      const errorMessage =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || "Failed to save game. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Preview game
  const handlePreview = async () => {
    if (!validateForm()) return;

    // Convert image files to base64
    const convertImageToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    };

    try {
      // Convert all word images to base64
      const wordsWithBase64 = await Promise.all(
        formData.words.map(async (w) => {
          let imageData = w.word_image_preview;

          // If word has a file object, convert to base64
          if (w.word_image) {
            imageData = await convertImageToBase64(w.word_image);
          }

          return {
            word_text: w.word_text,
            word_image_preview: imageData,
            hint: w.hint,
          };
        }),
      );

      // Store preview data in sessionStorage and navigate
      sessionStorage.setItem(
        "spell-word-preview",
        JSON.stringify({
          name: formData.name,
          description: formData.description,
          words: wordsWithBase64,
          score_per_word: formData.score_per_word,
          time_limit: formData.time_limit,
        }),
      );

      window.open(`/spell-the-word/play/preview`, "_blank");
    } catch (error) {
      console.error("Failed to prepare preview:", error);
      toast.error("Failed to prepare preview");
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-300 border-t-black" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Typography variant="h4">
              {isEditMode ? "Edit" : "Create"} Spell the Word
            </Typography>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={isSaving}
            >
              Save as Draft
            </Button>
            <Button
              onClick={() => handleSubmit(true)}
              disabled={isSaving}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isSaving ? "Saving..." : "Publish"}
            </Button>
          </div>
        </div>
      </header>

      {/* Form Content */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Basic Info */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h5 className="scroll-m-20 text-lg font-semibold tracking-tight">
            Basic Information
          </h5>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">
                Game Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Enter game name"
                className="mt-1"
              />
            </div>

            <div>
              <Label>
                Thumbnail Image <span className="text-red-500">*</span>
              </Label>
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  handleThumbnailChange(e.target.files?.[0] || null)
                }
              />
              {formData.thumbnail_preview ? (
                <div className="mt-1 relative w-32 h-20">
                  <img
                    src={formData.thumbnail_preview}
                    alt="Thumb"
                    className="w-full h-full object-cover rounded-lg border"
                  />
                  <button
                    onClick={() => handleThumbnailChange(null)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => thumbnailInputRef.current?.click()}
                  className="mt-1 w-32 h-20 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-purple-400 hover:text-purple-500 transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-xs">Upload</span>
                </button>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Enter game description"
              className="mt-1"
              rows={2}
            />
          </div>
        </section>

        {/* Game Settings */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h5 className="scroll-m-20 text-lg font-semibold tracking-tight">
            Game Settings
          </h5>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="time_limit">Time Limit (seconds per word)</Label>
              <Input
                id="time_limit"
                type="number"
                min={10}
                max={300}
                value={formData.time_limit}
                onChange={(e) =>
                  updateField("time_limit", parseInt(e.target.value) || 30)
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="score_per_word">Score per Word</Label>
              <Input
                id="score_per_word"
                type="number"
                min={10}
                max={1000}
                value={formData.score_per_word}
                onChange={(e) =>
                  updateField("score_per_word", parseInt(e.target.value) || 100)
                }
                className="mt-1"
              />
            </div>
          </div>
        </section>

        {/* Words List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h5 className="scroll-m-20 text-lg font-semibold tracking-tight">
              Words ({formData.words.length})
            </h5>
            <Button onClick={addWord} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Add Word
            </Button>
          </div>

          <div className="space-y-3">
            {formData.words.map((word, index) => (
              <WordItemCard
                key={index}
                word={word}
                index={index}
                onUpdateText={updateWordText}
                onUpdateImage={updateWordImage}
                onUpdateAudio={updateWordAudio}
                onDelete={deleteWord}
                onMoveUp={moveWordUp}
                onMoveDown={moveWordDown}
                isFirst={index === 0}
                isLast={index === formData.words.length - 1}
              />
            ))}
          </div>

          <Button
            onClick={addWord}
            variant="outline"
            className="w-full border-dashed border-2 py-6 text-slate-500 hover:text-slate-700 hover:border-slate-400"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Another Word
          </Button>
        </section>

        {/* Preview Info */}
        <section className="bg-purple-50 rounded-xl border border-purple-200 p-6">
          <h5 className="scroll-m-20 text-lg font-semibold tracking-tight text-purple-800 mb-2">
            Game Preview
          </h5>
          <div className="text-sm text-purple-700 space-y-1">
            <p>
              • Total Words:{" "}
              {formData.words.filter((w) => w.word_text.trim()).length}
            </p>
            <p>
              • Max Score:{" "}
              {formData.words.filter((w) => w.word_text.trim()).length *
                formData.score_per_word}
            </p>
            <p>• Time Limit: {formData.time_limit} seconds per word</p>
          </div>
          <Button
            variant="outline"
            className="mt-4 border-purple-300 text-purple-700 hover:bg-purple-100"
            onClick={handlePreview}
          >
            Preview Game
          </Button>
        </section>
      </main>
    </div>
  );
};

export default CreateSpellTheWord;
