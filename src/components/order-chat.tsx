"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  ImagePlus,
  MoreVertical,
  Plus,
  SendHorizonal,
  SwitchCamera,
  X,
} from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui";

export type ChatMessage = {
  id: string;
  body: string;
  imageUrl?: string | null;
  createdAt: string;
  isMine: boolean;
  isRead?: boolean;
  sender: { id: string; name: string; role: string };
};

type Props = {
  orderId: string;
  role: "customer" | "admin";
  className?: string;
  compact?: boolean;
  /** Back link under header (customer). Omit for embedded admin. */
  backHref?: string;
  showHeader?: boolean;
};

function formatChatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (startToday.getTime() - startMsg.getTime()) / 86400000;
  if (diff === 0) return "Hari ini";
  if (diff === 1) return "Kemarin";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function compressImage(file: File, maxW = 1280, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxW) {
        height = Math.round((height * maxW) / width);
        width = maxW;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas gagal"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal memuat foto"));
    };
    img.src = url;
  });
}

function compressDataUrl(
  dataUrl: string,
  maxW = 1280,
  quality = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxW) {
        height = Math.round((height * maxW) / width);
        width = maxW;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas gagal"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Gagal memproses foto"));
    img.src = dataUrl;
  });
}

export function OrderChat({
  orderId,
  role,
  className,
  compact,
  backHref,
  showHeader = true,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [orderNumber, setOrderNumber] = useState("");
  const [peerLabel, setPeerLabel] = useState("");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">(
    "environment"
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(
    async (facing: "environment" | "user" = cameraFacing) => {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setError("Kamera tidak didukung. Gunakan galeri.");
        return;
      }
      setCameraBusy(true);
      setError("");
      stopCamera();
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: facing },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
          });
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setCameraOpen(true);
        setCameraFacing(facing);
      } catch {
        setError("Izinkan akses kamera, atau pilih dari galeri.");
        setCameraOpen(false);
      } finally {
        setCameraBusy(false);
      }
    },
    [cameraFacing, stopCamera]
  );

  const closeCamera = useCallback(() => {
    stopCamera();
    setCameraOpen(false);
  }, [stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (!cameraOpen || !streamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    if (video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current;
      void video.play().catch(() => undefined);
    }
  }, [cameraOpen]);

  async function captureFromCamera() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError("Kamera belum siap");
      return;
    }
    setCameraBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas gagal");
      ctx.drawImage(video, 0, 0);
      const raw = canvas.toDataURL("image/jpeg", 0.92);
      const dataUrl = await compressDataUrl(raw);
      setPreview(dataUrl);
      setError("");
      closeCamera();
    } catch {
      setError("Gagal mengambil foto");
    } finally {
      setCameraBusy(false);
    }
  }

  const load = useCallback(async () => {
    const res = await api<{
      order: { orderNumber: string; customerName: string };
      messages: ChatMessage[];
    }>(`/api/messages?orderId=${orderId}`);
    if (!res.success || !res.data) {
      setError(res.error || "Gagal memuat chat");
      setLoading(false);
      return;
    }
    setMessages(res.data.messages || []);
    setOrderNumber(res.data.order.orderNumber);
    setPeerLabel(role === "admin" ? res.data.order.customerName : "Outlet");
    setLoading(false);
    setError("");
  }, [orderId, role]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, preview]);

  async function onPickFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Hanya gambar yang didukung");
      return;
    }
    try {
      setError("");
      setPreview(await compressImage(file));
    } catch {
      setError("Gagal memproses foto");
    }
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if ((!body && !preview) || sending) return;
    setSending(true);
    setError("");
    const res = await api<ChatMessage>("/api/messages", {
      method: "POST",
      body: JSON.stringify({
        orderId,
        body: body || undefined,
        image: preview || undefined,
      }),
    });
    setSending(false);
    if (!res.success) {
      setError(res.error || "Gagal mengirim");
      return;
    }
    setText("");
    setPreview(null);
    if (res.data) setMessages((m) => [...m, res.data!]);
    else await load();
  }

  const timeline = useMemo(() => {
    const rows: Array<
      | { type: "day"; key: string; label: string }
      | { type: "msg"; key: string; msg: ChatMessage }
    > = [];
    let lastDay = "";
    for (const m of messages) {
      const dk = dayKey(m.createdAt);
      if (dk !== lastDay) {
        rows.push({ type: "day", key: `d-${dk}`, label: dayLabel(m.createdAt) });
        lastDay = dk;
      }
      rows.push({ type: "msg", key: m.id, msg: m });
    }
    return rows;
  }, [messages]);

  const canSend = !!text.trim() || !!preview;
  const avatarLetter = (peerLabel || "?").charAt(0).toUpperCase();

  if (loading) {
    return (
      <div className={cn("flex flex-1 items-center justify-center bg-white", className)}>
        <Spinner className="!border-outline-variant !border-t-primary" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-surface-container-lowest",
        compact ? "h-[360px]" : "min-h-0 flex-1",
        className
      )}
    >
      {/* Header — messenger style */}
      {showHeader && (
        <header className="relative z-10 flex shrink-0 items-center gap-2 border-b border-outline-variant/40 bg-surface-container-lowest px-2 py-2.5">
          {backHref ? (
            <Link
              href={backHref}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
              aria-label="Kembali"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2} />
            </Link>
          ) : (
            <div className="w-1" />
          )}

          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-semibold text-primary">
              {avatarLetter}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold leading-tight text-on-surface">
                {peerLabel}
              </p>
              <p className="truncate text-xs leading-tight text-on-surface-variant">
                {orderNumber}
              </p>
            </div>
          </div>

          <div className="relative flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
              aria-label="Menu"
            >
              <MoreVertical className="h-5 w-5" strokeWidth={2} />
            </button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-20"
                  aria-label="Tutup menu"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-11 z-30 min-w-[9rem] overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container-lowest py-1 shadow-lg">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container"
                    onClick={() => {
                      setMenuOpen(false);
                      galleryRef.current?.click();
                    }}
                  >
                    <ImagePlus className="h-4 w-4" />
                    Galeri
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container"
                    onClick={() => {
                      setMenuOpen(false);
                      void startCamera("environment");
                    }}
                  >
                    <Camera className="h-4 w-4" />
                    Kamera
                  </button>
                </div>
              </>
            )}
          </div>
        </header>
      )}

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto bg-background px-3 py-4">
        {messages.length === 0 && !preview && (
          <p className="py-12 text-center text-sm text-on-surface-variant">
            Belum ada pesan
          </p>
        )}

        {timeline.map((row) => {
          if (row.type === "day") {
            return (
              <div key={row.key} className="flex justify-center py-1">
                <span className="rounded-full bg-surface-container px-3 py-1 text-[11px] font-medium text-on-surface-variant">
                  {row.label}
                </span>
              </div>
            );
          }

          const m = row.msg;
          return (
            <div
              key={row.key}
              className={cn(
                "flex flex-col",
                m.isMine ? "items-end" : "items-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[78%] px-3.5 py-2 text-[15px] leading-snug",
                  m.isMine
                    ? "rounded-[20px] bg-primary text-on-primary"
                    : "rounded-[20px] bg-surface-container text-on-surface"
                )}
              >
                {m.imageUrl && (
                  <button
                    type="button"
                    className="mb-1 block overflow-hidden rounded-2xl"
                    onClick={() => setLightboxSrc(m.imageUrl!)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.imageUrl}
                      alt=""
                      className="max-h-52 w-auto max-w-full object-cover"
                    />
                  </button>
                )}
                {m.body ? (
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                ) : null}
              </div>
              <div
                className={cn(
                  "mt-1 flex items-center gap-1 px-1",
                  m.isMine ? "flex-row-reverse" : "flex-row"
                )}
              >
                <span className="text-[11px] text-on-surface-variant">
                  {formatChatTime(m.createdAt)}
                </span>
                {m.isMine &&
                  (m.isRead ? (
                    <CheckCheck
                      className="h-3.5 w-3.5 text-primary"
                      strokeWidth={2.5}
                      aria-label="Sudah dibaca"
                    />
                  ) : (
                    <Check
                      className="h-3.5 w-3.5 text-on-surface-variant"
                      strokeWidth={2.5}
                      aria-label="Terkirim"
                    />
                  ))}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {preview && (
        <div className="flex items-center gap-2 border-t border-outline-variant/40 bg-surface-container/50 px-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt=""
            className="h-12 w-12 rounded-xl object-cover"
          />
          <p className="min-w-0 flex-1 text-xs text-on-surface-variant">
            Preview foto
          </p>
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container"
            aria-label="Hapus"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <p className="bg-error-container px-3 py-1.5 text-center text-xs text-on-error-container">
          {error}
        </p>
      )}

      {/* Composer */}
      <form
        onSubmit={send}
        className="flex shrink-0 items-center gap-2 border-t border-outline-variant/40 bg-surface-container/40 px-2.5 py-2.5"
      >
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void onPickFile(e.target.files?.[0] || null);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          disabled={sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container disabled:opacity-50"
          aria-label="Lampirkan"
        >
          <Plus className="h-6 w-6" strokeWidth={1.75} />
        </button>

        <div className="flex min-w-0 flex-1 items-center rounded-full border border-outline-variant bg-surface-container-lowest px-3.5 py-2 shadow-sm">
          <input
            className="min-w-0 flex-1 bg-transparent text-[15px] text-on-surface outline-none placeholder:text-on-surface-variant/70"
            placeholder="Pesan"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            disabled={sending}
            enterKeyHint="send"
          />
        </div>

        {canSend ? (
          <button
            type="submit"
            disabled={sending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm transition hover:opacity-90 disabled:opacity-50"
            aria-label="Kirim"
          >
            {sending ? (
              <Spinner className="!h-4 !w-4 !border-on-primary/30 !border-t-on-primary" />
            ) : (
              <SendHorizonal className="h-5 w-5" strokeWidth={2} />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void startCamera("environment")}
            disabled={sending || cameraBusy}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container disabled:opacity-50"
            aria-label="Kamera"
          >
            <Camera className="h-5 w-5" strokeWidth={1.75} />
          </button>
        )}
      </form>

      {/* Camera overlay */}
      {cameraOpen && (
        <div
          className="fixed inset-0 z-[110] flex flex-col bg-black"
          role="dialog"
          aria-modal
          aria-label="Kamera"
        >
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <button
              type="button"
              onClick={closeCamera}
              className="rounded-full p-2 hover:bg-white/10"
              aria-label="Tutup"
            >
              <X className="h-6 w-6" />
            </button>
            <p className="text-sm font-medium">Kamera</p>
            <button
              type="button"
              onClick={() =>
                void startCamera(
                  cameraFacing === "environment" ? "user" : "environment"
                )
              }
              disabled={cameraBusy}
              className="rounded-full p-2 hover:bg-white/10 disabled:opacity-50"
              aria-label="Ganti kamera"
            >
              <SwitchCamera className="h-6 w-6" />
            </button>
          </div>
          <div className="relative min-h-0 flex-1 bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                "h-full w-full object-cover",
                cameraFacing === "user" && "scale-x-[-1]"
              )}
            />
            {cameraBusy && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Spinner className="!border-white/30 !border-t-white" />
              </div>
            )}
          </div>
          <div className="flex items-center justify-center px-4 py-6">
            <button
              type="button"
              onClick={() => void captureFromCamera()}
              disabled={cameraBusy}
              className="h-16 w-16 rounded-full border-4 border-white bg-white/20 active:scale-95 disabled:opacity-50"
              aria-label="Ambil foto"
            >
              <span className="mx-auto block h-12 w-12 rounded-full bg-white" />
            </button>
          </div>
        </div>
      )}

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxSrc(null)}
          role="dialog"
          aria-modal
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-zinc-800"
            onClick={() => setLightboxSrc(null)}
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
