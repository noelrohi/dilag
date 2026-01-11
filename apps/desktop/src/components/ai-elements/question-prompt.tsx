"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { QuestionRequest } from "@/context/session-store";

export interface QuestionPromptProps {
  request: QuestionRequest;
  onReply: (answers: string[][]) => Promise<void>;
  onReject: () => Promise<void>;
  className?: string;
}

export function QuestionPrompt({
  request,
  onReply,
  onReject,
  className,
}: QuestionPromptProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [answers, setAnswers] = useState<string[][]>(
    request.questions.map(() => [])
  );
  const [customInputs, setCustomInputs] = useState<string[]>(
    request.questions.map(() => "")
  );
  const [showOther, setShowOther] = useState<boolean[]>(
    request.questions.map(() => false)
  );

  const currentQuestion = request.questions[activeTab];
  const isMultiple = currentQuestion?.multiple ?? false;
  const hasMultipleQuestions = request.questions.length > 1;
  const isLastQuestion = activeTab === request.questions.length - 1;

  const handleSelect = useCallback(
    (answer: string) => {
      setAnswers((prev) => {
        const newAnswers = [...prev];
        if (isMultiple) {
          const current = newAnswers[activeTab];
          if (current.includes(answer)) {
            newAnswers[activeTab] = current.filter((a) => a !== answer);
          } else {
            newAnswers[activeTab] = [...current, answer];
          }
        } else {
          newAnswers[activeTab] = [answer];
        }
        return newAnswers;
      });
      setCustomInputs((prev) => {
        const newInputs = [...prev];
        newInputs[activeTab] = "";
        return newInputs;
      });
      setShowOther((prev) => {
        const newShow = [...prev];
        newShow[activeTab] = false;
        return newShow;
      });
    },
    [activeTab, isMultiple]
  );

  const handleOtherClick = useCallback(() => {
    setShowOther((prev) => {
      const newShow = [...prev];
      newShow[activeTab] = true;
      return newShow;
    });
    setAnswers((prev) => {
      const newAnswers = [...prev];
      newAnswers[activeTab] = [];
      return newAnswers;
    });
  }, [activeTab]);

  const handleCustomInputChange = useCallback(
    (value: string) => {
      setCustomInputs((prev) => {
        const newInputs = [...prev];
        newInputs[activeTab] = value;
        return newInputs;
      });
      if (value.trim()) {
        setAnswers((prev) => {
          const newAnswers = [...prev];
          newAnswers[activeTab] = [value.trim()];
          return newAnswers;
        });
      }
    },
    [activeTab]
  );

  const handleSubmit = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsLoading(true);
      try {
        const finalAnswers = answers.map((ans, idx) => {
          const customInput = customInputs[idx];
          if (customInput && customInput.trim()) {
            return [customInput.trim()];
          }
          return ans;
        });
        await onReply(finalAnswers);
      } finally {
        setIsLoading(false);
      }
    },
    [answers, customInputs, onReply]
  );

  const handleReject = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsLoading(true);
      try {
        await onReject();
      } finally {
        setIsLoading(false);
      }
    },
    [onReject]
  );

  const hasCurrentAnswer =
    answers[activeTab]?.length > 0 ||
    (customInputs[activeTab] && customInputs[activeTab].trim());

  const allAnswered = answers.every(
    (ans, idx) => ans.length > 0 || (customInputs[idx] && customInputs[idx].trim())
  );

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden",
        className
      )}
    >
      {/* Header - minimal */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {hasMultipleQuestions ? `Question ${activeTab + 1}/${request.questions.length}` : "Question"}
        </span>
        {hasMultipleQuestions && (
          <div className="flex items-center gap-1">
            {request.questions.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveTab(idx)}
                className={cn(
                  "size-1.5 rounded-full transition-all",
                  idx === activeTab
                    ? "bg-foreground"
                    : answers[idx]?.length > 0 || customInputs[idx]?.trim()
                      ? "bg-foreground/40"
                      : "bg-foreground/20"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Question content */}
      <div className="px-4 py-4">
        <p className="text-sm text-foreground/90 mb-4">{currentQuestion?.question}</p>

        {/* Options as compact pills */}
        <div className="flex flex-wrap gap-2">
          {currentQuestion?.options.map((option, idx) => {
            const isSelected = answers[activeTab]?.includes(option.label);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(option.label)}
                className={cn(
                  "group relative px-3 py-1.5 rounded-full text-sm transition-all",
                  "border focus:outline-none focus:ring-2 focus:ring-primary/20",
                  isSelected
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-foreground/80 border-border/60 hover:border-foreground/40 hover:bg-foreground/5"
                )}
              >
                <span className="flex items-center gap-1.5">
                  {isSelected && <Check className="size-3" strokeWidth={2.5} />}
                  {option.label}
                </span>
              </button>
            );
          })}

          {/* Other option */}
          <button
            type="button"
            onClick={handleOtherClick}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm transition-all",
              "border focus:outline-none focus:ring-2 focus:ring-primary/20",
              showOther[activeTab]
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-foreground/50 border-dashed border-border/60 hover:border-foreground/40 hover:text-foreground/70"
            )}
          >
            Other...
          </button>
        </div>

        {/* Custom input - inline */}
        {showOther[activeTab] && (
          <div className="mt-3">
            <input
              type="text"
              placeholder="Type your answer..."
              value={customInputs[activeTab]}
              onChange={(e) => handleCustomInputChange(e.target.value)}
              autoFocus
              className={cn(
                "w-full px-3 py-2 text-sm rounded-lg",
                "bg-background/50 border border-border/60",
                "placeholder:text-muted-foreground/50",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-foreground/30"
              )}
            />
          </div>
        )}
      </div>

      {/* Footer - compact actions */}
      <div className="px-4 py-3 border-t border-border/40 flex items-center justify-between bg-muted/20">
        <button
          type="button"
          onClick={handleReject}
          disabled={isLoading}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          Dismiss
        </button>

        <div className="flex items-center gap-2">
          {hasMultipleQuestions && activeTab > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab(activeTab - 1)}
              disabled={isLoading}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <ChevronLeft className="size-3" />
              Back
            </button>
          )}

          {hasMultipleQuestions && !isLastQuestion ? (
            <button
              type="button"
              onClick={() => setActiveTab(activeTab + 1)}
              disabled={!hasCurrentAnswer || isLoading}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                hasCurrentAnswer
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              Next
              <ChevronRight className="size-3" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!allAnswered || isLoading}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                allAnswered && !isLoading
                  ? "bg-foreground text-background hover:bg-foreground/90 cursor-pointer"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isLoading ? "..." : "Submit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
