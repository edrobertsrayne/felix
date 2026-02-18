import { Database } from "bun:sqlite";
import fs from "fs";
import path from "path";
import type { Workspace } from "./workspace.js";

export interface SearchResult {
  snippet: string;
  filePath: string;
  lineNumber: number;
  score: number;
}

export function initSearch(workspace: Workspace): Database {
  const dbPath = path.join(workspace.root, "search.db");
  const db = new Database(dbPath);

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
      content,
      file_path,
      line_number,
      tokenize='porter'
    );
  `);

  return db;
}

export function indexMemoryFile(
  db: Database,
  filePath: string,
  content: string,
): void {
  db.prepare("DELETE FROM memory_fts WHERE file_path = ?").run(filePath);

  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      db.prepare(
        "INSERT INTO memory_fts (content, file_path, line_number) VALUES (?, ?, ?)",
      ).run(line, filePath, i + 1);
    }
  }
}

export function indexAllMemory(workspace: Workspace, db: Database): void {
  const memoryContent = fs.readFileSync(workspace.memoryFile, "utf-8");
  indexMemoryFile(db, workspace.memoryFile, memoryContent);

  const { memoryDir } = workspace;
  if (fs.existsSync(memoryDir)) {
    const files = fs.readdirSync(memoryDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const filePath = path.join(memoryDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      indexMemoryFile(db, filePath, content);
    }
  }
}

export function search(
  db: Database,
  query: string,
  limit: number = 5,
): SearchResult[] {
  if (!query.trim()) {
    return [];
  }

  const searchQuery = query
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => `"${w}"*`)
    .join(" ");

  try {
    const rows = db
      .prepare(
        `SELECT content, file_path, line_number, bm25(memory_fts) as score
        FROM memory_fts
        WHERE memory_fts MATCH ?
        ORDER BY score
        LIMIT ?`,
      )
      .all(searchQuery, limit) as Array<{
      content: string;
      file_path: string;
      line_number: number;
      score: number;
    }>;

    return rows.map((row) => ({
      snippet: row.content,
      filePath: row.file_path,
      lineNumber: row.line_number,
      score: 1 / (1 + Math.abs(row.score)),
    }));
  } catch (err) {
    console.error("[Search] Query failed:", err);
    return [];
  }
}

export function closeSearch(db: Database): void {
  db.close();
}
