"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
    GalleryVerticalEnd,
    Loader2,
    RefreshCcw,
    ArrowLeft,
    ArrowRight,
    RotateCcw,
    Sparkles,
    FileText,
    Upload,
    X,
    File,
    CheckCircle,
    Zap
} from "lucide-react";
import { apiUrl } from "@/lib/api";

interface Flashcard {
    front: string;
    back: string;
}

interface UploadFile {
    file: File;
    id: string;
    name: string;
    type: string;
    size: number;
}

export default function FlashcardPage() {
    const { t } = useTranslation();

    // State
    const [topic, setTopic] = useState("");
    const [count, setCount] = useState(5);
    const [isGenerating, setIsGenerating] = useState(false);
    const [cards, setCards] = useState<Flashcard[]>([]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Document upload
    const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [generationProgress, setGenerationProgress] = useState<"idle" | "parsing" | "generating">("idle");

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Helper functions
    const getFileExtension = (filename: string): string => {
        const parts = filename.split(".");
        return parts.length > 1 ? parts.pop()?.toLowerCase() || "" : "";
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    const generateFileId = () => Math.random().toString(36).substring(2, 15);

    const fileToUploadFile = (file: File): UploadFile => ({
        file,
        id: generateFileId(),
        name: file.name,
        type: getFileExtension(file.name),
        size: file.size,
    });

    const handleFileSelect = (files: FileList | null) => {
        if (!files) return;

        const newFiles = Array.from(files).filter(file => {
            const ext = getFileExtension(file.name);
            return ["docx", "pptx", "pdf", "doc", "ppt"].includes(ext);
        });

        if (newFiles.length === 0) {
            setError(t("Please select DOCX, PPTX, or PDF files"));
            return;
        }

        setError(null);

        setUploadFiles(prev => {
            const existingNames = new Set(prev.map(f => f.name));
            const uniqueNewFiles = newFiles
                .filter(f => !existingNames.has(f.name))
                .map(fileToUploadFile);
            return [...prev, ...uniqueNewFiles];
        });
    };

    const removeFile = (fileId: string) => {
        setUploadFiles(prev => prev.filter(f => f.id !== fileId));
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files);
        }
    };

    const handleGenerate = async () => {
        if (uploadFiles.length === 0) {
            setError(t("Please upload a document"));
            return;
        }

        setIsGenerating(true);
        setError(null);
        setCards([]);
        setCurrentCardIndex(0);
        setIsFlipped(false);

        try {
            // Generate from uploaded document
            setGenerationProgress("parsing");
            const formData = new FormData();
            formData.append("file", uploadFiles[0].file);
            formData.append("topic", topic || "General Review");
            formData.append("count", count.toString());
            formData.append("provider", "groq");

            const response = await fetch(apiUrl("/api/v1/flashcard/generate/from-document"), {
                method: "POST",
                body: formData,
            });
            setGenerationProgress("generating");

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || t("Failed to generate flashcards"));
            }

            const data = await response.json();
            if (data.cards && data.cards.length > 0) {
                setCards(data.cards);
            } else {
                setError(t("No flashcards were generated. Try a different topic."));
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsGenerating(false);
            setGenerationProgress("idle");
        }
    };

    const nextCard = () => {
        if (currentCardIndex < cards.length - 1) {
            setIsFlipped(false);
            setTimeout(() => setCurrentCardIndex((prev) => prev + 1), 150);
        }
    };

    const prevCard = () => {
        if (currentCardIndex > 0) {
            setIsFlipped(false);
            setTimeout(() => setCurrentCardIndex((prev) => prev - 1), 150);
        }
    };

    const getFileIcon = (type: string) => {
        switch (type) {
            case "pdf":
                return <FileText className="w-5 h-5 text-red-500" />;
            case "doc":
            case "docx":
                return <FileText className="w-5 h-5 text-blue-600" />;
            case "ppt":
            case "pptx":
                return <FileText className="w-5 h-5 text-orange-600" />;
            default:
                return <File className="w-5 h-5 text-slate-400" />;
        }
    };

    // Progress message
    const getProgressMessage = () => {
        if (generationProgress === "parsing") {
            return t("Parsing document...");
        } else if (generationProgress === "generating") {
            return t("Generating flashcards with AI...");
        }
        return t("Generating...");
    };

    return (
        <div className="h-full flex flex-col p-6 animate-fade-in overflow-y-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <GalleryVerticalEnd className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {t("Flashcard Generator")}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        {t("Generate study cards from documents or knowledge bases")}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto w-full">
                {/* Configuration Panel */}
                <div className="lg:col-span-1 space-y-6">

                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-blue-500" />
                            {t("Generation Settings")}
                        </h2>

                        <div className="space-y-4">
                            {/* Document Upload */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    {t("Upload Document")}
                                </label>

                                {/* Drag & Drop Zone */}
                                <div
                                    className={`relative border-2 border-dashed rounded-xl p-6 transition-all ${dragActive
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                        : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500"
                                        }`}
                                    onDragEnter={handleDragEnter}
                                    onDragLeave={handleDragLeave}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".docx,.pptx,.pdf,.doc,.ppt"
                                        onChange={(e) => handleFileSelect(e.target.files)}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        disabled={isGenerating}
                                    />

                                    <div className="flex flex-col items-center justify-center text-center">
                                        <Upload className="w-8 h-8 text-slate-400 mb-2" />
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {t("Drag & drop or click to upload")}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {t("DOCX, PPTX, PDF supported")}
                                        </p>
                                    </div>
                                </div>

                                {/* File List */}
                                {uploadFiles.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        {uploadFiles.map((uploadFile) => (
                                            <div
                                                key={uploadFile.id}
                                                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl"
                                            >
                                                {getFileIcon(uploadFile.type)}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                                        {uploadFile.name}
                                                    </p>
                                                    <p className="text-xs text-slate-400">
                                                        {formatFileSize(uploadFile.size)}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => removeFile(uploadFile.id)}
                                                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                                                    disabled={isGenerating}
                                                >
                                                    <X className="w-4 h-4 text-slate-400" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Topic Input */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    {t("Topic (Optional)")}
                                </label>
                                <input
                                    type="text"
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder={t("e.g. Key definitions")}
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                                    disabled={isGenerating}
                                />
                            </div>

                            {/* Count Slider */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    {t("Number of Cards")}: {count}
                                </label>
                                <input
                                    type="range"
                                    min="3"
                                    max="10"
                                    value={count}
                                    onChange={(e) => setCount(parseInt(e.target.value))}
                                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    disabled={isGenerating}
                                />
                            </div>

                            {/* Generate Button */}
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || uploadFiles.length === 0}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 mt-2"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {getProgressMessage()}
                                    </>
                                ) : (
                                    <>
                                        <Zap className="w-4 h-4" />
                                        {t("Generate Flashcards")}
                                    </>
                                )}
                            </button>

                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl mt-2 border border-red-100 dark:border-red-900/30">
                                    {error}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Display Panel */}
                <div className="lg:col-span-2 flex flex-col h-full min-h-[400px]">
                    {cards.length > 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-4">
                            {/* Card Container */}
                            <div
                                className="w-full max-w-lg aspect-[3/2] perspective-1000 cursor-pointer group"
                                onClick={() => setIsFlipped(!isFlipped)}
                            >
                                <div className={`relative w-full h-full transition-all duration-500 transform-style-3d ${isFlipped ? "rotate-y-180" : ""}`}>

                                    {/* Front */}
                                    <div className="absolute w-full h-full backface-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 flex flex-col items-center justify-center text-center">
                                        <div className="absolute top-4 left-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                            {t("Question")}
                                        </div>
                                        <h3 className="text-xl md:text-2xl font-medium text-slate-800 dark:text-slate-100">
                                            {cards[currentCardIndex].front}
                                        </h3>
                                        <div className="absolute bottom-4 text-xs text-slate-400">
                                            {t("Click to flip")}
                                        </div>
                                    </div>

                                    {/* Back */}
                                    <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-blue-50 dark:bg-blue-900/20 rounded-2xl shadow-xl border border-blue-100 dark:border-blue-800 p-8 flex flex-col items-center justify-center text-center">
                                        <div className="absolute top-4 left-4 text-xs font-semibold text-blue-500 uppercase tracking-wider">
                                            {t("Answer")}
                                        </div>
                                        <p className="text-lg md:text-xl text-slate-700 dark:text-slate-200">
                                            {cards[currentCardIndex].back}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="flex items-center gap-6 mt-8">
                                <button
                                    onClick={prevCard}
                                    disabled={currentCardIndex === 0}
                                    className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                                >
                                    <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                                </button>

                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                    {currentCardIndex + 1} / {cards.length}
                                </span>

                                <button
                                    onClick={nextCard}
                                    disabled={currentCardIndex === cards.length - 1}
                                    className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                                >
                                    <ArrowRight className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                                </button>
                            </div>

                            <button
                                onClick={() => {
                                    setCards([]);
                                    setTopic("");
                                }}
                                className="mt-6 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            >
                                <RotateCcw className="w-4 h-4" />
                                {t("Start Over")}
                            </button>
                        </div>
                    ) : (
                        // Empty State Placeholder
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
                                <GalleryVerticalEnd className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                                {t("Ready to Generate")}
                            </h3>
                            <p className="max-w-xs text-slate-500 dark:text-slate-400 text-sm">
                                {t("Upload a document and configure settings to begin.")}
                                {t("Upload a document and configure settings to begin.")}
                                {t("Upload a document and configure settings to begin.")}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
