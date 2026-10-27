import type Database from "better-sqlite3"

type Filter = Record<string, unknown>
type Update = Record<string, unknown>
type RecordRow = { id: string; owner_id: string | null; slug: string | null; status: string | null; payload: string; created_at: string; updated_at: string }

function getPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined, value)
}
function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split("."); let cursor = target
  for (const part of parts.slice(0, -1)) cursor = (cursor[part] ??= {}) as Record<string, unknown>
  cursor[parts[parts.length - 1]] = value
}
function matches(document: Record<string, unknown>, filter: Filter): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = getPath(document, key)
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const conditions = expected as Record<string, unknown>
      return Object.entries(conditions).every(([operator, value]) => {
        if (operator === "$in") return (value as unknown[]).includes(actual)
        if (operator === "$ne") return actual !== value
        if (operator === "$gt") return (actual as number) > (value as number)
        if (operator === "$exists") return (actual !== undefined) === value
        return false
      })
    }
    return actual === expected
  })
}

class SqliteDocument<T extends Record<string, unknown>> {
  constructor(private readonly collection: SqliteCollection<T>, private value: T) {
    return new Proxy(this, {
      get: (target, property, receiver) => property in target ? Reflect.get(target, property, receiver) : (target.value as Record<PropertyKey, unknown>)[property],
      set: (target, property, next) => {
        if (property in target) return Reflect.set(target, property, next)
        ;(target.value as Record<PropertyKey, unknown>)[property] = next
        return true
      },
      has: (target, property) => property in target || property in target.value,
    })
  }
  get id(): unknown { return this.value.id }
  get _id(): unknown { return this.value._id }
  get createdAt(): unknown { return this.value.createdAt }
  get updatedAt(): unknown { return this.value.updatedAt }
  toObject(): T { return structuredClone(this.value) }
  markModified(_path: string): void {}
  async save(): Promise<this> { this.value = this.collection.persist(this.value); return this }
  toJSON(): T { return this.toObject() }
}

class SqliteQuery<T> implements PromiseLike<T> {
  private sortSpec?: Record<string, 1 | -1>
  private projection?: Record<string, number>
  private leanMode = false
  constructor(private readonly runQuery: () => T | null, private readonly many = false) {}
  sort(spec: Record<string, 1 | -1>): this { this.sortSpec = spec; return this }
  select(spec: Record<string, number> | string): this {
    if (typeof spec === "string") this.projection = Object.fromEntries(spec.split(/\s+/).map((field) => [field.replace(/^-/, ""), field.startsWith("-") ? 0 : 1]))
    else this.projection = spec
    return this
  }
  lean(): this { this.leanMode = true; return this }
  exec(): Promise<T> { return Promise.resolve(this.result()) }
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected)
  }
  private result(): T {
    let result = this.runQuery() as T
    const processOne = (value: unknown) => {
      if (!value || typeof value !== "object") return value
      const raw = value instanceof SqliteDocument ? value.toObject() : value as Record<string, unknown>
      let output = raw
      if (this.projection) {
        const included = Object.entries(this.projection).filter(([, include]) => include === 1).map(([key]) => key)
        output = included.length ? Object.fromEntries(included.map((key) => [key, getPath(raw, key)]).filter(([, v]) => v !== undefined)) : structuredClone(raw)
        for (const [key, include] of Object.entries(this.projection)) if (!include) delete output[key]
      }
      return this.leanMode ? output : value instanceof SqliteDocument ? value : output
    }
    if (this.many && Array.isArray(result)) {
      let rows = result as unknown[]
      if (this.sortSpec) {
        const [field, order] = Object.entries(this.sortSpec)[0]
        rows = [...rows].sort((a, b) => String(getPath(a, field) ?? "").localeCompare(String(getPath(b, field) ?? "")) * order)
      }
      result = rows.map(processOne) as T
    } else result = processOne(result) as T
    return result
  }
}

export class SqliteCollection<T extends Record<string, unknown> = Record<string, unknown>> {
  constructor(private readonly db: Database.Database, private readonly name: string) {}
  private raw(): Array<{ row: RecordRow; value: T }> {
    return (this.db.prepare("SELECT * FROM app_records WHERE collection = ?").all(this.name) as RecordRow[]).map((row) => ({ row, value: JSON.parse(row.payload) as T }))
  }
  persist(input: T): T {
    const value = structuredClone(input) as Record<string, unknown>
    const now = new Date().toISOString()
    value["createdAt"] ??= now; value["updatedAt"] = now
    const id = String(value.id ?? value._id ?? value.userId ?? "")
    if (!id) throw new Error(`SQLite record in ${this.name} requires a stable id`)
    const owner = value.userId == null ? null : String(value.userId)
    const slug = value.slug == null ? null : String(value.slug)
    const status = value.status == null ? null : String(value.status)
    this.db.prepare(`INSERT INTO app_records(collection,id,owner_id,slug,status,payload,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(collection,id) DO UPDATE SET owner_id=excluded.owner_id,slug=excluded.slug,status=excluded.status,payload=excluded.payload,updated_at=excluded.updated_at`)
      .run(this.name, id, owner, slug, status, JSON.stringify(value), String(value.createdAt), now)
    return value as T
  }
  find(filter: Filter = {}): SqliteQuery<T[]> { return new SqliteQuery(() => this.raw().filter(({ value }) => matches({ ...value, _id: value.id }, filter)).map(({ value }) => new SqliteDocument(this, value) as unknown as T), true) }
  findOne(filter: Filter = {}): SqliteQuery<T | null> { return new SqliteQuery(() => { const found = this.raw().find(({ value }) => matches({ ...value, _id: value.id }, filter)); return found ? new SqliteDocument(this, found.value) as unknown as T : null }) }
  findById(id: string): SqliteQuery<T | null> { return this.findOne({ id }) }
  async exists(filter: Filter): Promise<boolean> { return this.raw().some(({ value }) => matches(value, filter)) }
  async create(input: Record<string, unknown>): Promise<T> { return this.persist(input as T) }
  findOneAndUpdate(filter: Filter, update: Update, options: Record<string, unknown> = {}): SqliteQuery<T | null> {
    return new SqliteQuery(() => {
      const found = this.raw().find(({ value }) => matches(value, filter))
      const isInsert = !found
      if (!found && !options.upsert) return null
      const current = found?.value ?? Object.fromEntries(Object.entries(filter).filter(([, v]) => typeof v !== "object")) as T
      const next = structuredClone(current) as Record<string, unknown>
      if (isInsert && options.defaults && typeof options.defaults === "object") {
        Object.assign(next, structuredClone(options.defaults))
      }
      const set = (update.$set ?? update) as Record<string, unknown>
      for (const [key, value] of Object.entries(set)) setPath(next, key, value)
      if (isInsert && update.$setOnInsert) Object.assign(next, update.$setOnInsert)
      return new SqliteDocument(this, this.persist(next as T)) as unknown as T
    })
  }
  updateOne(filter: Filter, update: Update): Promise<{ matchedCount: number; modifiedCount: number }> & { exec: () => Promise<{ matchedCount: number; modifiedCount: number }> } {
    const found = this.raw().find(({ value }) => matches(value, filter)); if (!found) return Object.assign(Promise.resolve({ matchedCount: 0, modifiedCount: 0 }), { exec: () => Promise.resolve({ matchedCount: 0, modifiedCount: 0 }) })
    const next = structuredClone(found.value) as T & Record<string, unknown>
    for (const [key, value] of Object.entries((update.$set ?? update) as Record<string, unknown>)) setPath(next, key, value)
    this.persist(next); return Object.assign(Promise.resolve({ matchedCount: 1, modifiedCount: 1 }), { exec: () => Promise.resolve({ matchedCount: 1, modifiedCount: 1 }) })
  }
  deleteOne(filter: Filter): Promise<{ deletedCount: number }> & { exec: () => Promise<{ deletedCount: number }> } {
    const found = this.raw().find(({ value }) => matches(value, filter)); if (!found) return Object.assign(Promise.resolve({ deletedCount: 0 }), { exec: () => Promise.resolve({ deletedCount: 0 }) })
    const id = String(found.value.id ?? found.value._id)
    const result = { deletedCount: this.db.prepare("DELETE FROM app_records WHERE collection=? AND id=?").run(this.name, id).changes }
    return Object.assign(Promise.resolve(result), { exec: () => Promise.resolve(result) })
  }
  deleteMany(filter: Filter): Promise<{ deletedCount: number }> & { exec: () => Promise<{ deletedCount: number }> } {
    const ids = this.raw().filter(({ value }) => matches(value, filter)).map(({ value }) => String(value.id ?? value._id))
    const remove = this.db.prepare("DELETE FROM app_records WHERE collection=? AND id=?")
    const transaction = this.db.transaction(() => ids.reduce((count, id) => count + remove.run(this.name, id).changes, 0))
    const result = { deletedCount: transaction() }
    return Object.assign(Promise.resolve(result), { exec: () => Promise.resolve(result) })
  }
  async bulkWrite(operations: Array<{ updateOne: { filter: Filter; update: Update; upsert?: boolean } }>): Promise<void> {
    const transaction = this.db.transaction(() => {
      for (const operation of operations) {
        const { filter, update, upsert } = operation.updateOne
        const found = this.raw().find(({ value }) => matches(value, filter))
        if (found) { const next = structuredClone(found.value) as T & Record<string, unknown>; Object.assign(next, update.$set ?? update); this.persist(next) }
        else if (upsert) { const seed = Object.fromEntries(Object.entries(filter).filter(([, v]) => typeof v !== "object")) as T; this.persist({ ...seed, ...(update.$setOnInsert ?? {}) } as T) }
      }
    })
    transaction()
  }
}
