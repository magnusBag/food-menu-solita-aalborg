import { v4 as uuidv4 } from "uuid";
import type { MenuItem } from "../models/menuItem";

type DuelStatus = "waiting" | "ready" | "in_progress" | "finished";

type DuelPlayer = {
  cookie: string;
  userName: string;
  score: number;
};

type DuelRound = {
  id: string;
  mode: "image-to-name" | "name-to-image";
  prompt?: string; // for name-to-image
  image?: string; // for image-to-name
  options: Array<{
    id: string;
    label?: string;
    imageurl?: string;
    alt?: string;
  }>;
  correctOptionId: string;
  createdAtMs: number;
  expiresAtMs: number;
  answers: Map<string, { optionId: string; correct: boolean; atMs: number }>; // cookie -> answer
  acceptingAnswers: boolean;
};

export type DuelPublicState = {
  duelId: string;
  status: DuelStatus;
  players: Array<{ cookie: string; userName: string; score: number }>;
  round?: {
    id: string;
    mode: "image-to-name" | "name-to-image";
    prompt?: string;
    image?: string;
    options: Array<{
      id: string;
      label?: string;
      imageurl?: string;
      alt?: string;
    }>;
    expiresAtMs: number;
  };
  nextAtMs?: number;
};

type DuelRoom = {
  id: string;
  status: DuelStatus;
  host: DuelPlayer;
  guest?: DuelPlayer;
  round?: DuelRound;
  roundTtlMs: number;
  nextAtMs?: number;
};

export class DuelService {
  private readonly rooms = new Map<string, DuelRoom>();
  private readonly subscribers = new Map<
    string,
    Set<(state: DuelPublicState) => void>
  >();

  constructor(
    private readonly getAllMenuItems: () => Promise<MenuItem[]>,
    private readonly options?: { roundTtlMs?: number }
  ) {}

  create(
    hostCookie: string,
    hostName: string,
    startingScore: number
  ): DuelRoom {
    const id = uuidv4();
    const room: DuelRoom = {
      id,
      status: "waiting",
      host: { cookie: hostCookie, userName: hostName, score: startingScore },
      roundTtlMs: this.options?.roundTtlMs ?? 5000,
    };
    this.rooms.set(id, room);
    this.emit(id);
    return room;
  }

  join(
    id: string,
    guestCookie: string,
    guestName: string,
    startingScore: number
  ): DuelRoom | null {
    const room = this.rooms.get(id);
    if (!room) return null;
    // Prevent host from joining their own duel as guest
    if (room.host.cookie === guestCookie) return null;
    if (room.guest && room.guest.cookie !== guestCookie) return null;
    if (!room.guest) {
      room.guest = {
        cookie: guestCookie,
        userName: guestName,
        score: startingScore,
      };
      room.status = "ready";
    }
    this.emit(id);
    return room;
  }

  getState(id: string): DuelPublicState | null {
    const room = this.rooms.get(id);
    if (!room) return null;
    return this.toPublicState(room);
  }

  async startRound(id: string): Promise<DuelPublicState | null> {
    const room = this.rooms.get(id);
    if (!room) return null;
    if (!room.guest) return this.toPublicState(room);

    const items = await this.getAllMenuItems();
    const itemsWithImages = items.filter((i) => Boolean(i.imageurl));
    if (itemsWithImages.length < 3) {
      // Not enough items to create round
      room.round = undefined;
      return this.toPublicState(room);
    }

    const correct = this.pickRandom(itemsWithImages);
    const decoys = this.pickUniqueRandom(
      itemsWithImages.filter((i) => i.name !== correct.name),
      2
    );
    const shuffled = this.shuffleArray([correct, ...decoys]);
    const options = shuffled.map((i) => ({
      id: uuidv4(),
      label: i.name,
      imageurl: i.imageurl ?? undefined,
      alt: i.name,
    }));

    const correctOption = options.find((o) => o.label === correct.name)!;
    const mode: "image-to-name" | "name-to-image" =
      Math.random() < 0.5 ? "image-to-name" : "name-to-image";
    const now = Date.now();
    const round: DuelRound = {
      id: uuidv4(),
      mode,
      prompt: mode === "name-to-image" ? correct.name : undefined,
      image:
        mode === "image-to-name" ? correct.imageurl ?? undefined : undefined,
      options,
      correctOptionId: correctOption.id,
      createdAtMs: now,
      expiresAtMs: now + room.roundTtlMs,
      answers: new Map(),
      acceptingAnswers: true,
    };
    room.round = round;
    room.status = "in_progress";
    const state = this.toPublicState(room);
    this.emit(id);
    return state;
  }

  answer(
    id: string,
    playerCookie: string,
    roundId: string,
    optionId: string
  ): { correct: boolean } | { error: string } {
    const room = this.rooms.get(id);
    if (!room) return { error: "Duel not found" };
    if (!room.round) return { error: "No active round" };
    if (room.round.id !== roundId) return { error: "Round mismatch" };
    if (Date.now() > room.round.expiresAtMs) return { error: "Round expired" };

    // Disallow answers after first submission
    if (!room.round.acceptingAnswers) return { error: "Round closed" };

    const already = room.round.answers.get(playerCookie);
    if (already) return { error: "Already answered" };

    const correct = optionId === room.round.correctOptionId;
    room.round.answers.set(playerCookie, {
      optionId,
      correct,
      atMs: Date.now(),
    });

    // First answer locks the round
    room.round.acceptingAnswers = false;

    // Determine if we should end immediately (we do per requirement)
    const someoneCorrect = Array.from(room.round.answers.values()).some(
      (a) => a.correct
    );
    if (correct) {
      if (room.host.cookie === playerCookie) {
        room.host.score += 1;
      } else if (room.guest && room.guest.cookie === playerCookie) {
        room.guest.score += 1;
      }
    }
    const bothAnswered = room.guest
      ? room.round.answers.has(room.host.cookie) &&
        room.round.answers.has(room.guest.cookie)
      : false;

    // End round and schedule next regardless of correctness of first answer
    room.status = "ready";
    room.round = undefined;
    // Schedule next round in 5 seconds
    room.nextAtMs = Date.now() + 5000;
    setTimeout(async () => {
      // If room still exists and no new round started, begin next
      const r = this.rooms.get(id);
      if (!r) return;
      r.nextAtMs = undefined;
      await this.startRound(id);
    }, 5000);

    this.emit(id);
    return { correct };
  }

  subscribe(id: string, fn: (state: DuelPublicState) => void): () => void {
    const set = this.subscribers.get(id) ?? new Set();
    set.add(fn);
    this.subscribers.set(id, set);
    // Immediately push current state
    const state = this.getState(id);
    if (state) fn(state);
    return () => {
      const s = this.subscribers.get(id);
      if (!s) return;
      s.delete(fn);
      if (s.size === 0) this.subscribers.delete(id);
    };
  }

  private emit(id: string): void {
    const set = this.subscribers.get(id);
    if (!set || set.size === 0) return;
    const state = this.getState(id);
    if (!state) return;
    set.forEach((fn) => fn(state));
  }

  private toPublicState(room: DuelRoom): DuelPublicState {
    return {
      duelId: room.id,
      status: room.status,
      players: [room.host, room.guest].filter(Boolean).map((p) => ({
        cookie: (p as DuelPlayer).cookie,
        userName: (p as DuelPlayer).userName,
        score: (p as DuelPlayer).score,
      })),
      round: room.round
        ? {
            id: room.round.id,
            mode: room.round.mode,
            prompt: room.round.prompt,
            image: room.round.image,
            options: room.round.options.map((o) => ({
              id: o.id,
              label: o.label,
              imageurl: o.imageurl,
              alt: o.alt,
            })),
            expiresAtMs: room.round.expiresAtMs,
          }
        : undefined,
      nextAtMs: room.nextAtMs,
    };
  }

  private pickRandom<T>(array: T[]): T {
    const index = Math.floor(Math.random() * array.length);
    return array[index];
  }

  private pickUniqueRandom<T>(array: T[], count: number): T[] {
    if (count <= 0) return [];
    if (array.length <= count) return this.shuffleArray(array).slice(0, count);
    const chosen: T[] = [];
    const pool = [...array];
    while (chosen.length < count && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      const [item] = pool.splice(idx, 1);
      chosen.push(item);
    }
    return chosen;
  }

  private shuffleArray<T>(items: T[]): T[] {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
