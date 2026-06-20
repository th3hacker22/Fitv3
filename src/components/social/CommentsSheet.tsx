"use client";
import { useState, useEffect, useRef } from "react";
import { Drawer } from "vaul";
import { MessageSquare, Send, Trash2, X } from "lucide-react";
import { useSocialStore, type Comment } from "@/store/useSocialStore";
import { useAuthStore } from "@/store/useAuthStore";

interface Props {
  postId: string;
  commentCount: number;
}

// Stable empty array reference — avoids creating a new [] on every render
// which would trigger Zustand's snapshot change detection → infinite loop.
const EMPTY_COMMENTS: Comment[] = [];

export default function CommentsSheet({ postId, commentCount }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Individual selector instead of bare store subscription
  const user = useAuthStore((s) => s.user);
  // Selector returns a stable reference (EMPTY_COMMENTS) when undefined,
  // preventing the "getSnapshot should be cached" infinite loop.
  const comments = useSocialStore((s) => s.commentsByPost[postId] ?? EMPTY_COMMENTS);
  const loadComments = useSocialStore((s) => s.loadComments);
  const addComment = useSocialStore((s) => s.addComment);
  const deleteComment = useSocialStore((s) => s.deleteComment);

  useEffect(() => {
    if (isOpen) {
      // loadComments returns a Promise (API fetch), not an unsubscribe fn.
      loadComments(postId).catch(console.error);
    }
  }, [isOpen, postId, loadComments]);

  // Scroll to bottom when comments list updates
  useEffect(() => {
    if (isOpen && commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || text.length > 500 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addComment(postId, text.trim());
      setText("");
    } catch (error) {
      console.error("Failed to add comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (window.confirm("Are you sure you want to delete this comment?")) {
      try {
        await deleteComment(postId, commentId);
      } catch (error) {
        console.error("Failed to delete comment:", error);
      }
    }
  };

  return (
    <Drawer.Root open={isOpen} onOpenChange={setIsOpen} shouldScaleBackground>
      <Drawer.Trigger asChild>
        <button className="flex items-center gap-1.5 text-xs font-bold text-text-secondary hover:text-primary transition-colors cursor-pointer hover:scale-105 active:scale-95" aria-label={`Comments (${commentCount})`}>
          <MessageSquare className="w-4 h-4" aria-hidden="true" />
          <span aria-hidden="true">💬 Comments ({commentCount})</span>
        </button>
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-[201] mx-auto max-w-md rounded-t-2xl bg-bg-card flex flex-col max-h-[85vh]">
          {/* Drag Handle */}
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-border shrink-0" />

          <div className="flex flex-col flex-1 p-5 overflow-hidden">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between shrink-0">
              <Drawer.Title className="text-base font-bold text-text-primary uppercase tracking-wider">
                <span aria-hidden="true">💬 </span>Comments
              </Drawer.Title>
              <Drawer.Close asChild>
                <button aria-label="Close comments" className="flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors">
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </Drawer.Close>
            </div>

            {/* Comments List */}
            <ul className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[150px] mb-4 list-none" role="list">
              {comments.length > 0 ? (
                comments.map((comment) => (
                  <li key={comment.id} className="flex gap-3 group items-start">
                    {comment.authorPhotoURL ? (
                      <img
                        src={comment.authorPhotoURL}
                        alt={comment.authorName}
                        className="w-8 h-8 rounded-full bg-bg-elevated object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                        {comment.authorName.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 bg-bg-elevated/50 rounded-2xl p-3 border border-border/30">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-xs text-text-primary truncate">
                          {comment.authorName}
                        </span>
                        <span className="text-xs text-text-secondary uppercase shrink-0">
                          {new Date(comment.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary break-words leading-relaxed whitespace-pre-wrap">
                        {comment.text}
                      </p>
                    </div>

                    {user && user.uid === comment.authorUid && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        aria-label="Delete comment"
                        className="p-2 text-text-secondary hover:text-error hover:bg-error/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0 self-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))
              ) : (
                <li className="list-none">
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                    <MessageSquare className="h-10 w-10 text-text-secondary/30" aria-hidden="true" />
                    <p className="text-sm font-medium text-text-secondary">No comments yet</p>
                    <p className="text-xs text-text-secondary/60">Be the first to share your thoughts!</p>
                  </div>
                </li>
              )}
              <li className="list-none" aria-hidden="true">
                <div ref={commentsEndRef} />
              </li>
            </ul>

            {/* Comment Input Footer */}
            <form onSubmit={handleSubmit} className="border-t border-border/50 pt-4 shrink-0">
              <div className="flex gap-2 items-end">
                <div className="flex-1 relative">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Write a comment..."
                    aria-label="Write a comment"
                    maxLength={500}
                    rows={1}
                    className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary text-text-primary resize-none max-h-24 pr-12"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                  />
                  <span className="absolute right-2 bottom-1.5 text-xs text-text-secondary">
                    {text.length}/500
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={!text.trim() || text.length > 500 || isSubmitting}
                  aria-label="Send comment"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-[#0A0A0B] transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:pointer-events-none shrink-0"
                >
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </form>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
