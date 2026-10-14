"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiFailure } from "@/lib/client";

export type Repeat = "off" | "all" | "one";

// ~1 second of silence; played inside a user gesture to unlock audio on iOS/Android before async fetches.
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
const CHARS_PER_SEC = 14; // estimate until a chunk's real duration is known

type Opts = {
  voice: string;
  speed: number;
  onChunk?: (index: number) => void;
  onTick?: (index: number, time: number) => void;
  onFinished?: () => void;
  meta?: { title: string; artist: string };
};

export function useAudioEngine(opts: Opts) {
  const o = useRef(opts);
  o.current = opts;

  const audio = useRef<HTMLAudioElement | null>(null);
  const chunks = useRef<string[]>([]);
  const durations = useRef<Map<number, number>>(new Map());
  const cache = useRef<Map<string, string>>(new Map());
  const pending = useRef<Map<string, Promise<string>>>(new Map());
  const token = useRef(0);
  const voiceRef = useRef(opts.voice);
  const speedRef = useRef(opts.speed);
  const repeatRef = useRef<Repeat>("off");
  const volumeRef = useRef(1);
  const wantPlay = useRef(false);
  const busy = useRef(false); // a passage is being fetched/started
  const indexRef = useRef(0);

  const [count, setCount] = useState(0);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [speed, setSpeedState] = useState(opts.speed);
  const [repeat, setRepeatState] = useState<Repeat>("off");
  const [ready, setReady] = useState(false);
  const [, bump] = useState(0);

  const el = () => {
    if (!audio.current) {
      const a = new Audio();
      a.preload = "auto";
      (a as any).preservesPitch = true;
      audio.current = a;
    }
    return audio.current;
  };

  const fetchChunk = useCallback((i: number): Promise<string> => {
    const text = chunks.current[i];
    const key = `${voiceRef.current}\u0000${text}`;
    const hit = cache.current.get(key);
    if (hit) return Promise.resolve(hit);
    let p = pending.current.get(key);
    if (!p) {
      p = (async () => {
        let res: Response;
        try {
          res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice: voiceRef.current }) });
        } catch {
          throw new ApiFailure("We couldn't reach the voice service. Check your connection and try again.");
        }
        if (res.status === 401) {
          window.location.href = "/sign-in?expired=1";
          throw new ApiFailure("Your session has expired.");
        }
        if (!res.ok) throw new ApiFailure((await res.json().catch(() => null))?.error ?? "We couldn't generate audio for this passage. Please try again.");
        const url = URL.createObjectURL(await res.blob());
        cache.current.set(key, url);
        if (cache.current.size > 14) {
          const first = cache.current.keys().next().value!;
          URL.revokeObjectURL(cache.current.get(first)!);
          cache.current.delete(first);
        }
        return url;
      })().finally(() => pending.current.delete(key));
      pending.current.set(key, p);
    }
    return p;
  }, []);

  const startChunk = useCallback(
    async (i: number, play: boolean, time = 0) => {
      if (i < 0 || i >= chunks.current.length) return;
      const my = ++token.current;
      wantPlay.current = play;
      indexRef.current = i;
      setIndex(i);
      o.current.onChunk?.(i);
      busy.current = true;
      setError(null);
      setLoading(true);
      setCur(time);
      setDur(durations.current.get(i) ?? 0);
      const a = el();
      a.pause();
      try {
        const url = await fetchChunk(i);
        if (my !== token.current) return;
        a.src = url;
        a.playbackRate = speedRef.current;
        a.volume = volumeRef.current;
        if (time > 0) a.addEventListener("loadedmetadata", () => (a.currentTime = time), { once: true });
        setReady(true);
        busy.current = false;
        // the user may have pressed pause/play while this passage was loading
        if (wantPlay.current) await a.play();
        setLoading(false);
        // warm up the next passages
        for (const n of [i + 1, i + 2]) if (n < chunks.current.length) fetchChunk(n).catch(() => {});
      } catch (e) {
        if (my !== token.current) return;
        busy.current = false;
        setLoading(false);
        setPlaying(false);
        if ((e as Error).name === "NotAllowedError") setError("Your browser blocked autoplay. Tap play to start listening.");
        else if ((e as Error).name === "AbortError") return;
        else setError(e instanceof ApiFailure ? e.message : "We couldn't play this audio. Please try again.");
      }
    },
    [fetchChunk],
  );

  // wire the <audio> element once
  useEffect(() => {
    const a = el();
    const onTime = () => {
      setCur(a.currentTime);
      o.current.onTick?.(indexRef.current, a.currentTime);
    };
    const onMeta = () => {
      if (isFinite(a.duration) && !a.src.startsWith("data:")) {
        durations.current.set(indexRef.current, a.duration);
        setDur(a.duration);
        bump((n) => n + 1);
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => {
      const i = indexRef.current;
      if (repeatRef.current === "one") return void startChunk(i, true);
      if (i + 1 < chunks.current.length) return void startChunk(i + 1, true);
      if (repeatRef.current === "all") return void startChunk(0, true);
      setPlaying(false);
      o.current.onFinished?.();
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnd);
    const urls = cache.current;
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnd);
      a.pause();
      token.current++;
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlock = useCallback(() => {
    const a = el();
    if (a.src) return;
    a.src = SILENCE;
    a.play().then(() => a.pause()).catch(() => {});
  }, []);

  const load = useCallback(
    (list: string[], start = 0, autoplay = false, startTime = 0) => {
      token.current++;
      el().pause();
      chunks.current = list;
      durations.current = new Map();
      setCount(list.length);
      setReady(false);
      setPlaying(false);
      setError(null);
      if (list.length) void startChunk(Math.min(start, list.length - 1), autoplay, startTime);
    },
    [startChunk],
  );

  const hasSrc = () => !!el().src && !el().src.startsWith("data:");

  const play = useCallback(async () => {
    const a = el();
    if (!chunks.current.length) return;
    if (busy.current) {
      wantPlay.current = true; // playback starts as soon as the passage is ready
      return;
    }
    if (!hasSrc() || error) return void startChunk(indexRef.current, true, hasSrc() ? a.currentTime : 0);
    try {
      wantPlay.current = true;
      await a.play();
    } catch {
      void startChunk(indexRef.current, true, a.currentTime);
    }
  }, [error, startChunk]);

  const pause = useCallback(() => {
    wantPlay.current = false;
    el().pause();
  }, []);

  const toggle = useCallback(() => {
    if (busy.current) {
      wantPlay.current = !wantPlay.current;
      return;
    }
    return el().paused ? play() : pause();
  }, [play, pause]);
  const next = useCallback(() => void startChunk(Math.min(indexRef.current + 1, chunks.current.length - 1), !el().paused || loadingPlay(), 0), [startChunk]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadingPlay = () => wantPlay.current;
  const prev = useCallback(() => {
    const a = el();
    // like most players: first press restarts the passage, a press near the start goes back
    const wasPlaying = !a.paused || wantPlay.current;
    if (a.currentTime > 3) void startChunk(indexRef.current, wasPlaying);
    else void startChunk(Math.max(indexRef.current - 1, 0), wasPlaying);
  }, [startChunk]);
  const goTo = useCallback((i: number, autoplay = true, t = 0) => void startChunk(i, autoplay, t), [startChunk]);

  const chunkLen = (i: number) => durations.current.get(i) ?? Math.max(1, chunks.current[i]?.length ?? 0) / CHARS_PER_SEC;
  const total = Array.from({ length: count }, (_, i) => chunkLen(i)).reduce((a, b) => a + b, 0);
  const before = Array.from({ length: index }, (_, i) => chunkLen(i)).reduce((a, b) => a + b, 0);
  const elapsed = before + cur;

  const seekTotal = useCallback(
    (t: number) => {
      let acc = 0;
      const n = chunks.current.length;
      for (let i = 0; i < n; i++) {
        const len = chunkLen(i);
        if (t < acc + len || i === n - 1) {
          const off = Math.max(0, Math.min(t - acc, len - 0.05));
          if (i === indexRef.current && hasSrc()) el().currentTime = off;
          else void startChunk(i, !el().paused || wantPlay.current, off);
          return;
        }
        acc += len;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startChunk],
  );

  const setVolume = useCallback((v: number) => {
    volumeRef.current = v;
    el().volume = v;
    setVolumeState(v);
  }, []);
  const setSpeed = useCallback((s: number) => {
    speedRef.current = s;
    el().playbackRate = s;
    setSpeedState(s);
  }, []);
  const setRepeat = useCallback((r: Repeat) => {
    repeatRef.current = r;
    setRepeatState(r);
  }, []);
  const setVoice = useCallback(
    (id: string) => {
      if (id === voiceRef.current) return;
      voiceRef.current = id;
      if (chunks.current.length) void startChunk(indexRef.current, !el().paused || wantPlay.current, 0);
    },
    [startChunk],
  );

  // keep in sync with externally controlled voice/speed props
  useEffect(() => setVoice(opts.voice), [opts.voice, setVoice]);
  useEffect(() => setSpeed(opts.speed), [opts.speed, setSpeed]);

  // lock-screen / headset controls
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const m = navigator.mediaSession;
    if (opts.meta) m.metadata = new MediaMetadata({ title: opts.meta.title, artist: opts.meta.artist, album: "Ebookvox", artwork: [{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }] });
    m.setActionHandler("play", () => void play());
    m.setActionHandler("pause", pause);
    m.setActionHandler("previoustrack", prev);
    m.setActionHandler("nexttrack", next);
    return () => {
      for (const k of ["play", "pause", "previoustrack", "nexttrack"] as const) m.setActionHandler(k, null);
    };
  }, [opts.meta?.title, opts.meta?.artist, play, pause, prev, next]); // eslint-disable-line react-hooks/exhaustive-deps

  return { count, index, playing, loading, error, cur, dur, volume, speed, repeat, ready, total, elapsed, unlock, load, play, pause, toggle, next, prev, goTo, seekTotal, setVolume, setSpeed, setRepeat, setVoice, audioEl: el };
}
export type Engine = ReturnType<typeof useAudioEngine>;
