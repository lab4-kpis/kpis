import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type StoredItems = Record<string, string>;

/**
 * Supabase Auth storage backed by a file only the current user can read.
 * Reads from disk on every access so the server picks up a `login` run from the terminal.
 */
export class FileSessionStore {
  readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  getItem(key: string): string | null {
    return this.read()[key] ?? null;
  }

  setItem(key: string, value: string) {
    this.write({ ...this.read(), [key]: value });
  }

  removeItem(key: string) {
    const items = this.read();
    delete items[key];
    this.write(items);
  }

  clear() {
    rmSync(this.path, { force: true });
  }

  private read(): StoredItems {
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.path, "utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
    } catch {
      return {};
    }
  }

  private write(items: StoredItems) {
    if (Object.keys(items).length === 0) {
      this.clear();
      return;
    }
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(items), { mode: 0o600 });
    renameSync(temporary, this.path);
  }
}
