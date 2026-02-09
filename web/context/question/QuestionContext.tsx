"use client";

import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
} from "react";
import { wsUrl, apiUrl } from "@/lib/api";
import {
  QuestionContextState,
  QuestionProgressInfo,
  INITIAL_QUESTION_CONTEXT_STATE,
  DEFAULT_QUESTION_AGENT_STATUS,
  DEFAULT_QUESTION_TOKEN_STATS,
} from "@/types/question";
import { LogEntry } from "@/types/common";

// Context type
interface QuestionContextType {
  questionState: QuestionContextState;
  setQuestionState: React.Dispatch<React.SetStateAction<QuestionContextState>>;
  startQuestionGen: (
    uploadMode: "kb" | "document",
    selectedKb: string,
    uploadedFile: File | null,
    difficulty: string,
    count: number,
  ) => void;
  startMimicQuestionGen: (
    file: File | null,
    paperPath: string,
    kb: string,
    maxQuestions?: number,
  ) => void;
  resetQuestionGen: () => void;
}

const QuestionContext = createContext<QuestionContextType | undefined>(
  undefined,
);

export function QuestionProvider({ children }: { children: React.ReactNode }) {
  const [questionState, setQuestionState] = useState<QuestionContextState>(
    INITIAL_QUESTION_CONTEXT_STATE,
  );
  const questionWs = useRef<WebSocket | null>(null);

  const addQuestionLog = useCallback((log: LogEntry) => {
    setQuestionState((prev) => ({ ...prev, logs: [...prev.logs, log] }));
  }, []);

  // Helper function to handle mimic WebSocket messages
  const handleMimicWsMessage = useCallback(
    (data: any, ws: WebSocket) => {
      const stageMap: Record<string, string> = {
        init: "uploading",
        upload: "uploading",
        parsing: "parsing",
        processing: "extracting",
      };

      switch (data.type) {
        case "log":
          addQuestionLog(data);
          break;

        case "status": {
          const mappedStage = stageMap[data.stage] || data.stage;
          addQuestionLog({
            type: "system",
            content: data.content || data.message || `Stage: ${data.stage}`,
          });
          if (mappedStage) {
            setQuestionState((prev) => ({
              ...prev,
              progress: { ...prev.progress, stage: mappedStage },
            }));
          }
          break;
        }

        case "progress": {
          const stage = data.stage || "generating";
          if (data.message) {
            addQuestionLog({ type: "system", content: data.message });
          }
          setQuestionState((prev) => ({
            ...prev,
            progress: {
              ...prev.progress,
              stage: stage,
              progress: {
                ...prev.progress.progress,
                current: data.current ?? prev.progress.progress.current,
                total:
                  data.total_questions ??
                  data.total ??
                  prev.progress.progress.total,
                status: data.status,
              },
            },
          }));
          if (
            stage === "extracting" &&
            data.status === "complete" &&
            data.reference_questions
          ) {
            setQuestionState((prev) => ({
              ...prev,
              progress: {
                ...prev.progress,
                progress: {
                  ...prev.progress.progress,
                  total:
                    data.total_questions || data.reference_questions.length,
                },
              },
            }));
          }
          break;
        }

        case "question_update": {
          const statusMessage =
            data.status === "generating"
              ? `Generating mimic question ${data.index}...`
              : data.status === "failed"
                ? `Question ${data.index} failed: ${data.error}`
                : `Question ${data.index}: ${data.status}`;
          addQuestionLog({
            type: data.status === "failed" ? "warning" : "system",
            content: statusMessage,
          });
          if (data.current !== undefined) {
            setQuestionState((prev) => ({
              ...prev,
              progress: {
                ...prev.progress,
                progress: { ...prev.progress.progress, current: data.current },
              },
            }));
          }
          break;
        }

        case "result": {
          const isExtended =
            data.extended || data.validation?.decision === "extended";
          addQuestionLog({
            type: "success",
            content: `✅ Question ${data.index || (data.current ?? 0)} generated successfully`,
          });
          setQuestionState((prev) => ({
            ...prev,
            results: [
              ...prev.results,
              {
                success: true,
                question_id: data.question_id || `q_${prev.results.length + 1}`,
                question: data.question,
                validation: data.validation,
                rounds: data.rounds || 1,
                reference_question: data.reference_question,
                extended: isExtended,
              },
            ],
            progress: {
              ...prev.progress,
              stage: "generating",
              progress: {
                ...prev.progress.progress,
                current: data.current ?? prev.results.length + 1,
                total: data.total ?? prev.progress.progress.total ?? 1,
              },
              extendedQuestions:
                (prev.progress.extendedQuestions || 0) + (isExtended ? 1 : 0),
            },
          }));
          break;
        }

        case "summary":
          addQuestionLog({
            type: "success",
            content: `Generation complete: ${data.successful}/${data.total_reference} succeeded`,
          });
          setQuestionState((prev) => ({
            ...prev,
            progress: {
              ...prev.progress,
              stage: "generating",
              progress: {
                current: data.successful,
                total: data.total_reference,
              },
              completedQuestions: data.successful,
              failedQuestions: data.failed,
            },
          }));
          break;

        case "complete":
          addQuestionLog({
            type: "success",
            content: "✅ Mimic generation completed!",
          });
          setQuestionState((prev) => ({
            ...prev,
            step: "result",
            progress: {
              ...prev.progress,
              stage: "complete",
              completedQuestions: prev.results.length,
            },
          }));
          ws.close();
          break;

        case "error":
          addQuestionLog({
            type: "error",
            content: `Error: ${data.content || data.message || "Unknown error"}`,
          });
          setQuestionState((prev) => ({
            ...prev,
            step: "config",
            progress: { stage: null, progress: {} },
          }));
          break;
      }
    },
    [addQuestionLog],
  );

  const startQuestionGen = useCallback(
    async (
      uploadMode: "kb" | "document",
      selectedKb: string,
      uploadedFile: File | null,
      difficulty: string,
      count: number,
    ) => {
      if (questionWs.current) questionWs.current.close();

      setQuestionState((prev) => ({
        ...prev,
        step: "generating",
        mode: "knowledge",
        uploadMode,
        logs: [],
        results: [],
        difficulty,
        count,
        selectedKb,
        uploadedFile,
        progress: {
          stage: "generating",
          progress: { current: 0, total: count },
          subFocuses: [],
          activeQuestions: [],
          completedQuestions: 0,
          failedQuestions: 0,
        },
        agentStatus: { ...DEFAULT_QUESTION_AGENT_STATUS },
        tokenStats: { ...DEFAULT_QUESTION_TOKEN_STATS },
      }));

      addQuestionLog({
        type: "system",
        content: "Initializing exam question generator...",
      });

      try {
        let response;

        if (uploadMode === "kb") {
          // KB mode - use /generate/from-kb endpoint
          addQuestionLog({
            type: "system",
            content: `Generating questions from Knowledge Base: ${selectedKb}`,
          });

          response = await fetch(apiUrl("/api/v1/question/generate/from-kb"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kb_name: selectedKb,
              difficulty,
              count: parseInt(String(count), 10),
            }),
          });
        } else {
          // Document mode - use /generate/from-document endpoint
          if (!uploadedFile) {
            throw new Error("No file uploaded");
          }

          addQuestionLog({
            type: "system",
            content: `Uploading and processing document: ${uploadedFile.name}`,
          });

          const formData = new FormData();
          formData.append("file", uploadedFile);
          formData.append("difficulty", difficulty);
          formData.append("count", count.toString());

          response = await fetch(
            apiUrl("/api/v1/question/generate/from-document"),
            {
              method: "POST",
              body: formData,
            },
          );
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.detail || `HTTP error! status: ${response.status}`,
          );
        }

        const data = await response.json();

        addQuestionLog({
          type: "success",
          content: `✅ Successfully generated ${data.questions.length} questions`,
        });

        // Convert questions to the expected format
        const results = data.questions.map((q: any, idx: number) => ({
          success: true,
          question_id: `q_${idx + 1}`,
          question: {
            question: q.question,
            correct_answer: q.answer,
            explanation: q.explanation,
            type: "written",
            question_type: "written",
          },
          validation: {},
          rounds: 1,
          extended: false,
        }));

        setQuestionState((prev) => ({
          ...prev,
          step: "result",
          results,
          progress: {
            ...prev.progress,
            stage: "complete",
            progress: { current: results.length, total: count },
            completedQuestions: results.length,
          },
        }));
      } catch (error: any) {
        addQuestionLog({
          type: "error",
          content: `Error: ${error.message || "Unknown error occurred"}`,
        });
        setQuestionState((prev) => ({
          ...prev,
          step: "config",
          progress: {
            stage: null,
            progress: {},
          },
        }));
      }
    },
    [addQuestionLog],
  );

  const startMimicQuestionGen = useCallback(
    async (
      file: File | null,
      paperPath: string,
      kb: string,
      maxQuestions?: number,
    ) => {
      if (questionWs.current) questionWs.current.close();

      const hasFile = file !== null;
      const hasParsedPath = paperPath && paperPath.trim() !== "";

      if (!hasFile && !hasParsedPath) {
        addQuestionLog({
          type: "error",
          content:
            "Please upload a PDF file or provide a parsed exam directory",
        });
        return;
      }

      setQuestionState((prev) => ({
        ...prev,
        step: "generating",
        mode: "mimic",
        logs: [],
        results: [],
        selectedKb: kb,
        uploadedFile: file,
        paperPath: paperPath,
        progress: {
          stage: hasFile ? "uploading" : "parsing",
          progress: { current: 0, total: maxQuestions || 1 },
        },
        agentStatus: { ...DEFAULT_QUESTION_AGENT_STATUS },
        tokenStats: { ...DEFAULT_QUESTION_TOKEN_STATS },
      }));

      const ws = new WebSocket(wsUrl("/api/v1/question/mimic"));
      questionWs.current = ws;

      ws.onopen = async () => {
        if (hasFile && file) {
          addQuestionLog({
            type: "system",
            content: "Preparing to upload PDF file...",
          });
          const reader = new FileReader();
          reader.onload = () => {
            const base64Data = (reader.result as string).split(",")[1];
            ws.send(
              JSON.stringify({
                mode: "upload",
                pdf_data: base64Data,
                pdf_name: file.name,
                kb_name: kb,
                max_questions: maxQuestions,
              }),
            );
            addQuestionLog({
              type: "system",
              content: `Uploaded: ${file.name}, parsing...`,
            });
          };
          reader.readAsDataURL(file);
        } else {
          ws.send(
            JSON.stringify({
              mode: "parsed",
              paper_path: paperPath,
              kb_name: kb,
              max_questions: maxQuestions,
            }),
          );
          addQuestionLog({
            type: "system",
            content: "Initializing Mimic Generator...",
          });
        }
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleMimicWsMessage(data, ws);
      };

      ws.onerror = () => {
        addQuestionLog({
          type: "error",
          content: "WebSocket connection error",
        });
        setQuestionState((prev) => ({ ...prev, step: "config" }));
      };
    },
    [addQuestionLog, handleMimicWsMessage],
  );

  const resetQuestionGen = useCallback(() => {
    setQuestionState((prev) => ({
      ...prev,
      step: "config",
      results: [],
      logs: [],
      progress: {
        stage: null,
        progress: {},
        subFocuses: [],
        activeQuestions: [],
        completedQuestions: 0,
        failedQuestions: 0,
      },
      agentStatus: { ...DEFAULT_QUESTION_AGENT_STATUS },
      tokenStats: { ...DEFAULT_QUESTION_TOKEN_STATS },
      uploadedFile: null,
      paperPath: "",
    }));
  }, []);

  return (
    <QuestionContext.Provider
      value={{
        questionState,
        setQuestionState,
        startQuestionGen,
        startMimicQuestionGen,
        resetQuestionGen,
      }}
    >
      {children}
    </QuestionContext.Provider>
  );
}

export const useQuestion = () => {
  const context = useContext(QuestionContext);
  if (!context)
    throw new Error("useQuestion must be used within QuestionProvider");
  return context;
};
