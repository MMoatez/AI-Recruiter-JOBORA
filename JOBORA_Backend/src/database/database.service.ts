import { Injectable, OnModuleDestroy } from "@nestjs/common"
import Database from "better-sqlite3"
import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { SqliteCollection } from "./sqlite-collection"

export type SqlRow = Record<string, unknown>

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly connection: Database.Database

  constructor() {
    const configured = process.env.SQLITE_PATH || "data/jobora.sqlite"
    const filePath = configured === ":memory:" ? configured : resolve(process.cwd(), configured)
    if (filePath !== ":memory:") mkdirSync(dirname(filePath), { recursive: true })
    this.connection = new Database(filePath)
    this.connection.pragma("journal_mode = WAL")
    this.connection.pragma("foreign_keys = ON")
    this.connection.pragma("busy_timeout = 5000")
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cvs (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, payload TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS cvs_owner_updated ON cvs(user_id, updated_at DESC);
      CREATE TABLE IF NOT EXISTS cover_letters (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, cv_id TEXT,
        status TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS letters_owner_updated ON cover_letters(user_id, updated_at DESC);
      CREATE TABLE IF NOT EXISTS prep_sessions (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, status TEXT NOT NULL, payload TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS prep_owner_updated ON prep_sessions(user_id, updated_at DESC);
      CREATE TABLE IF NOT EXISTS portfolios (
        user_id TEXT PRIMARY KEY, slug TEXT UNIQUE, status TEXT NOT NULL, payload TEXT NOT NULL,
        source_cv_name TEXT NOT NULL DEFAULT '', source_cv_text TEXT NOT NULL DEFAULT '', source_cv BLOB,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS training_plans (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS training_plans_owner ON training_plans(user_id, updated_at DESC);
      CREATE TABLE IF NOT EXISTS training_progress (
        user_id TEXT NOT NULL, plan_id TEXT NOT NULL, task_id TEXT NOT NULL, payload TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(user_id, plan_id, task_id)
      );
      CREATE TABLE IF NOT EXISTS training_questions (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS training_question_skill_review ON training_questions(json_extract(payload, '$.skill'), json_extract(payload, '$.reviewStatus'));
      CREATE TABLE IF NOT EXISTS training_sessions (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, status TEXT NOT NULL, payload TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS training_sessions_owner ON training_sessions(user_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS training_mastery (
        session_id TEXT NOT NULL, question_id TEXT NOT NULL, user_id TEXT NOT NULL, concept_id TEXT NOT NULL,
        created_at TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(session_id, question_id)
      );
      CREATE INDEX IF NOT EXISTS training_mastery_owner_concept ON training_mastery(user_id, concept_id, created_at);
      CREATE TABLE IF NOT EXISTS app_records (
        collection TEXT NOT NULL, id TEXT NOT NULL, owner_id TEXT, slug TEXT, status TEXT,
        payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        PRIMARY KEY(collection, id), UNIQUE(collection, slug)
      );
      CREATE INDEX IF NOT EXISTS app_records_owner_updated ON app_records(collection, owner_id, updated_at DESC);
      CREATE TABLE IF NOT EXISTS portfolio_files (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, filename TEXT NOT NULL, content BLOB NOT NULL
      );
    `)
  }

  collection<T extends Record<string, any> = Record<string, any>>(name: string): SqliteCollection<T> {
    return new SqliteCollection<T>(this.connection, name)
  }

  now(): string { return new Date().toISOString() }

  parse<T extends SqlRow = SqlRow>(value: unknown): T {
    return JSON.parse(String(value)) as T
  }

  onModuleDestroy(): void { this.connection.close() }
}
