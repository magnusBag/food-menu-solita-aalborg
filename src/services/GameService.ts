import { v4 as uuidv4 } from "uuid";
import type { MenuItem } from "../models/menuItem";

export type GameMode = "image-to-name" | "name-to-image";

type RoundOption = {
  id: string;
  itemName: string;
  imageurl: string | null;
};

type RoundState = {
  id: string;
  mode: GameMode;
  correctItemName: string;
  correctOptionId: string;
  options: RoundOption[];
  createdAtMs: number;
  answered: boolean;
};

type GameSession = {
  usedItemNames: Set<string>;
  activeRound?: RoundState;
};

export type StartOrNextRoundResponse =
  | {
      roundId: string;
      mode: "image-to-name";
      image: string;
      options: Array<{ id: string; label: string }>;
      expiresAtMs: number;
    }
  | {
      roundId: string;
      mode: "name-to-image";
      prompt: string;
      options: Array<{ id: string; imageurl: string; alt: string }>;
      expiresAtMs: number;
    };

export type AnswerResult = { correct: boolean } | { error: string };

export class GameService {
  private readonly sessions = new Map<string, GameSession>();
  private readonly roundTtlMs: number;

  constructor(
    private readonly getAllMenuItems: () => Promise<MenuItem[]>,
    options?: { roundTtlMs?: number }
  ) {
    this.roundTtlMs = options?.roundTtlMs ?? 1000 * 60 * 5; // default 5 minutes
  }

  async start(userCookie: string): Promise<StartOrNextRoundResponse> {
    const session = this.getOrCreateSession(userCookie);
    session.usedItemNames.clear();
    return this.createAndSetRound(session);
  }

  async next(userCookie: string): Promise<StartOrNextRoundResponse | null> {
    const session = this.getOrCreateSession(userCookie);

    if (this.hasUnansweredActiveRound(session)) {
      return null;
    }

    return this.createAndSetRound(session);
  }

  answer(userCookie: string, roundId: string, optionId: string): AnswerResult {
    const session = this.sessions.get(userCookie);
    if (!session || !session.activeRound) {
      return { error: "No active round" };
    }

    const round = session.activeRound;

    if (round.id !== roundId) {
      return { error: "Round mismatch" };
    }

    if (round.answered) {
      return { error: "Round already answered" };
    }

    if (Date.now() > round.createdAtMs + this.roundTtlMs) {
      round.answered = true;
      return { correct: false };
    }

    round.answered = true;
    const isCorrect = optionId === round.correctOptionId;
    return { correct: isCorrect };
  }

  private getOrCreateSession(userCookie: string): GameSession {
    const existing = this.sessions.get(userCookie);
    if (existing) {
      return existing;
    }
    const created: GameSession = {
      usedItemNames: new Set<string>(),
    };
    this.sessions.set(userCookie, created);
    return created;
  }

  private hasUnansweredActiveRound(session: GameSession): boolean {
    if (!session.activeRound) {
      return false;
    }
    const round = session.activeRound;
    const isExpired = Date.now() > round.createdAtMs + this.roundTtlMs;
    return !round.answered && !isExpired;
  }

  private async createAndSetRound(
    session: GameSession
  ): Promise<StartOrNextRoundResponse> {
    const items = await this.getAllMenuItems();
    const itemsWithImages = items.filter((i) => Boolean(i.imageurl));

    const available = itemsWithImages.filter(
      (i) => !session.usedItemNames.has(i.name)
    );

    const candidatePool = available.length > 0 ? available : itemsWithImages;
    if (candidatePool.length === 0) {
      throw new Error("No menu items available to generate a round");
    }

    const correct = this.pickRandom(candidatePool);
    session.usedItemNames.add(correct.name);

    const decoys = this.pickUniqueRandom(
      itemsWithImages.filter((i) => i.name !== correct.name),
      2
    );

    const allOptionsSource = this.shuffleArray([correct, ...decoys]);
    const options: RoundOption[] = allOptionsSource.map((i) => ({
      id: uuidv4(),
      itemName: i.name,
      imageurl: i.imageurl ?? null,
    }));

    const correctOption = options.find((o) => o.itemName === correct.name)!;
    const mode: GameMode =
      Math.random() < 0.5 ? "image-to-name" : "name-to-image";

    const roundState: RoundState = {
      id: uuidv4(),
      mode,
      correctItemName: correct.name,
      correctOptionId: correctOption.id,
      options,
      createdAtMs: Date.now(),
      answered: false,
    };

    session.activeRound = roundState;

    const expiresAtMs = roundState.createdAtMs + this.roundTtlMs;

    if (mode === "image-to-name") {
      return {
        roundId: roundState.id,
        mode,
        image: correct.imageurl ?? "",
        options: options.map((o) => ({ id: o.id, label: o.itemName })),
        expiresAtMs,
      };
    }

    return {
      roundId: roundState.id,
      mode,
      prompt: correct.name,
      options: options.map((o) => ({
        id: o.id,
        imageurl: o.imageurl ?? "",
        alt: o.itemName,
      })),
      expiresAtMs,
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
