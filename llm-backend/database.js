const Database = require('better-sqlite3');
// Membuat file database bernama llm_manager.db
const db = new Database('llm_manager.db', { verbose: console.log });

// Perintah SQL untuk membuat tabel 'engines'
// Tabel ini untuk menyimpan daftar software LLM (LM Studio, Jan, dll)
db.exec(`
  CREATE TABLE IF NOT EXISTS engines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL, 
    endpoint TEXT NOT NULL,
    status TEXT DEFAULT 'offline'
  )
`);

console.log("Database llm_manager.db dan Tabel 'engines' sudah siap.");

module.exports = db;