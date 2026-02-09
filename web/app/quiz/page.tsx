"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
    ClipboardList,
    Loader2,
    Sparkles,
    BookOpen,
    RotateCcw,
    Trophy,
    Brain,
    FileText,
    Upload,
    X,
    File,
    Zap
} from "lucide-react";
import { apiUrl } from "@/lib/api";

interface QuizQuestion {
    question: string;
    options?: string[];
    correct_answer?: string | number;
    answer?: string;
    explanation?: string;
}

interface KnowledgeBase {
    name: string;
    is_default?: boolean;
}

interface UploadFile {
    file: File;
    id: string;
    name: string;
    type: string;
    size: number;
}

export default function QuizPage() {
    const { t } = useTranslation();

    // State
    const [count, setCount] = useState(5);
    const [difficulty, setDifficulty] = useState("medium");
    const [isGenerating, setIsGenerating] = useState(false);
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [score, setScore] = useState(0);
    const [answeredQuestions, setAnsweredQuestions] = useState<boolean[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [quizCompleted, setQuizCompleted] = useState(false);

    // Document upload mode - enforced
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

        // Only allow one file for now or replace existing
        setUploadFiles(newFiles.map(fileToUploadFile).slice(0, 1));
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
        setQuestions([]);
        setCurrentQuestionIndex(0);
        setShowAnswer(false);
        setSelectedOption(null);
        setScore(0);
        setQuizCompleted(false);
        setAnsweredQuestions([]);

        try {
            setGenerationProgress("parsing");
            const formData = new FormData();
            formData.append("file", uploadFiles[0].file);
            formData.append("difficulty", difficulty);
            formData.append("count", count.toString());

            const response = await fetch(apiUrl("/api/v1/question/generate/from-document"), {
                method: "POST",
                body: formData,
            });
            setGenerationProgress("generating");

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || t("Failed to generate quiz"));
            }

            const data = await response.json();
            if (data.questions && data.questions.length > 0) {
                setQuestions(data.questions);
                setAnsweredQuestions(new Array(data.questions.length).fill(false));
            } else {
                setError(t("No questions were generated. Try a different document."));
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsGenerating(false);
            setGenerationProgress("idle");
        }
    };

    const handleOptionSelect = (optionIndex: number) => {
        if (showAnswer) return; // Prevent changing answer after showing result
        setSelectedOption(optionIndex);
    };

    const handleSubmitAnswer = () => {
        if (selectedOption === null) return;
        setShowAnswer(true);

        const currentQ = questions[currentQuestionIndex];
        // Check if answer is correct (simplified check, assuming correct_answer is index or string)
        // Backend returns correct_answer as index (number)
        const isCorrect = selectedOption === Number(currentQ.correct_answer);

        if (isCorrect && !answeredQuestions[currentQuestionIndex]) {
            setScore(prev => prev + 1);
            setAnsweredQuestions(prev => {
                const newArr = [...prev];
                newArr[currentQuestionIndex] = true;
                return newArr;
            });
        }
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setShowAnswer(false);
            setSelectedOption(null);
        } else {
            setQuizCompleted(true);
        }
    };

    const handleRestart = () => {
        setQuestions([]);
        setCurrentQuestionIndex(0);
        setShowAnswer(false);
        setSelectedOption(null);
        setScore(0);
        setQuizCompleted(false);
        setAnsweredQuestions([]);
    };

    const currentQuestion = questions[currentQuestionIndex];

    const getProgressMessage = () => {
        if (generationProgress === "parsing") {
            return t("Parsing document...");
        } else if (generationProgress === "generating") {
            return t("Generating MCQs...");
        }
        return t("Generating...");
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

    return (
        <div className="h-full flex flex-col p-6 animate-fade-in overflow-y-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <ClipboardList className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {t("Exam Question Generator")}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        {t("Generate multiple-choice questions from your documents")}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto w-full">
                {/* Configuration Panel */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-500" />
                            {t("Quiz Settings")}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    {t("Upload Document")}
                                </label>

                                {/* Drag & Drop Zone */}
                                <div
                                    className={`relative border-2 border-dashed rounded-xl p-6 transition-all ${dragActive
                                        ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                                        : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500"
                                        }`}
                                    onDragEnter={handleDragEnter}
                                    onDragLeave={handleDragEnter}
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

                            {/* Difficulty Selection */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    {t("Difficulty")}
                                </label>
                                <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
                                    {["easy", "medium", "hard"].map((level) => (
                                        <button
                                            key={level}
                                            onClick={() => setDifficulty(level)}
                                            disabled={isGenerating || questions.length > 0}
                                            className={`flex-1 py-2 px-2 text-xs font-medium rounded-md transition-all ${difficulty === level
                                                ? "bg-white dark:bg-slate-600 text-purple-600 dark:text-purple-400 shadow-sm"
                                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                                                }`}
                                        >
                                            {t(level.charAt(0).toUpperCase() + level.slice(1))}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Count Slider */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    {t("Number of Questions")}: {count}
                                </label>
                                <input
                                    type="range"
                                    min="3"
                                    max="10"
                                    value={count}
                                    onChange={(e) => setCount(parseInt(e.target.value))}
                                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                    disabled={isGenerating || questions.length > 0}
                                />
                            </div>

                            {/* Generate Button */}
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || uploadFiles.length === 0 || questions.length > 0}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20 mt-2"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {getProgressMessage()}
                                    </>
                                ) : (
                                    <>
                                        <Zap className="w-4 h-4" />
                                        {t("Generate MCQs")}
                                    </>
                                )}
                            </button>

                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl mt-2 border border-red-100 dark:border-red-900/30">
                                    {error}
                                </div>
                            )}

                            {/* Progress Display */}
                            {questions.length > 0 && !quizCompleted && (
                                <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">{t("Progress")}</span>
                                        <span className="font-semibold text-purple-600 dark:text-purple-400">
                                            {currentQuestionIndex + 1} / {questions.length}
                                        </span>
                                    </div>
                                    <div className="mt-2 text-sm flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">{t("Score")}</span>
                                        <span className="font-semibold text-green-600 dark:text-green-400">
                                            {score} / {questions.length}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quiz Display Panel */}
                <div className="lg:col-span-2 flex flex-col h-full min-h-[400px]">
                    {quizCompleted ? (
                        // Quiz Completed Screen
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl border border-purple-200 dark:border-purple-800">
                            <div className="w-20 h-20 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center mb-6">
                                <Trophy className="w-10 h-10 text-purple-600 dark:text-purple-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                                {t("Quiz Completed!")}
                            </h3>
                            <p className="text-lg text-slate-600 dark:text-slate-400 mb-6">
                                {t("You scored")} {score} {t("out of")} {questions.length}
                            </p>
                            <button
                                onClick={handleRestart}
                                className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-purple-500/20"
                            >
                                <RotateCcw className="w-4 h-4" />
                                {t("Start New Quiz")}
                            </button>
                        </div>
                    ) : questions.length > 0 && currentQuestion ? (
                        // Question Display
                        <div className="flex-1 flex flex-col p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                                        {t("Question")} {currentQuestionIndex + 1}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                                    </span>
                                </div>
                                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                                    {currentQuestion.question}
                                </h3>
                            </div>

                            {/* Options Section */}
                            <div className="space-y-3 mb-6">
                                {currentQuestion.options?.map((option, idx) => {
                                    const isSelected = selectedOption === idx;
                                    const isCorrect = Number(currentQuestion.correct_answer) === idx;
                                    const showResultStatus = showAnswer;

                                    let optionClass = "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700";

                                    if (showResultStatus) {
                                        if (isCorrect) {
                                            optionClass = "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
                                        } else if (isSelected) {
                                            optionClass = "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
                                        } else {
                                            optionClass = "opacity-50";
                                        }
                                    } else if (isSelected) {
                                        optionClass = "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 ring-1 ring-purple-500";
                                    }

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => handleOptionSelect(idx)}
                                            disabled={showAnswer}
                                            className={`w-full text-left p-4 rounded-xl border transition-all ${optionClass}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 text-xs font-medium ${showResultStatus && isCorrect
                                                    ? "bg-green-500 border-green-500 text-white"
                                                    : showResultStatus && isSelected && !isCorrect
                                                        ? "bg-red-500 border-red-500 text-white"
                                                        : isSelected
                                                            ? "bg-purple-600 border-purple-600 text-white"
                                                            : "border-slate-300 dark:border-slate-600 text-slate-500"
                                                    }`}>
                                                    {String.fromCharCode(65 + idx)}
                                                </div>
                                                <span className={`text-sm ${showResultStatus && isCorrect
                                                    ? "text-green-900 dark:text-green-300 font-medium"
                                                    : showResultStatus && isSelected && !isCorrect
                                                        ? "text-red-900 dark:text-red-300"
                                                        : "text-slate-700 dark:text-slate-300"
                                                    }`}>
                                                    {option}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Explanation (only shown after answering) */}
                            {showAnswer && currentQuestion.explanation && (
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 mb-6 animate-fade-in">
                                    <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">
                                        {t("Explanation")}:
                                    </p>
                                    <p className="text-sm text-blue-800 dark:text-blue-200">
                                        {currentQuestion.explanation}
                                    </p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="mt-auto flex gap-3">
                                {!showAnswer ? (
                                    <button
                                        onClick={handleSubmitAnswer}
                                        disabled={selectedOption === null}
                                        className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {t("Submit Answer")}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleNextQuestion}
                                        className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-purple-500/20"
                                    >
                                        {currentQuestionIndex < questions.length - 1 ? t("Next Question") : t("Finish Quiz")}
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Empty State
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
                                <ClipboardList className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                                {t("Ready to Generate")}
                            </h3>
                            <p className="max-w-xs text-slate-500 dark:text-slate-400 text-sm">
                                {t("Upload a document to generate MCQs.")}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
