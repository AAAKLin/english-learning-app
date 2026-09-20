import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';

const app = express(), port = process.env.PORT || 8787;
const db = new Database(process.env.DB_PATH || './lumina.sqlite');
app.use(cors()); app.use(express.json());
db.exec(`CREATE TABLE IF NOT EXISTS vocabulary (
  id TEXT PRIMARY KEY, word TEXT UNIQUE NOT NULL, category TEXT NOT NULL,
  meaning TEXT, phonetic TEXT, pos TEXT, example_en TEXT, example_zh TEXT,
  feynman TEXT, native_tip TEXT, enriched_at TEXT
);
CREATE TABLE IF NOT EXISTS user_words (user_id TEXT NOT NULL, word_id TEXT NOT NULL, created_at TEXT NOT NULL, reviewed_at TEXT, PRIMARY KEY(user_id,word_id));
CREATE TABLE IF NOT EXISTS reminders (user_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 1, last_sent TEXT);
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);

const categories = ['airport','direction','taxi','dining','attraction','chat','hotel','shopping','emergency','work','health','social'];
const categoryNames = {airport:'机场',direction:'问路',taxi:'打车',dining:'点餐',attraction:'景点',chat:'攀谈聊天',hotel:'酒店入住',shopping:'购物',emergency:'紧急情况',work:'工作交流',health:'健康就医',social:'日常社交'};
const wordLists = [
  'https://raw.githubusercontent.com/imjxyang/English-words/master/wiki/1-1000.csv',
  'https://raw.githubusercontent.com/imjxyang/English-words/master/wiki/1001-2000.csv',
  'https://raw.githubusercontent.com/imjxyang/English-words/master/wiki/2001-3000.csv'
];

async function ensureVocabulary() {
  const version = db.prepare("SELECT value FROM app_settings WHERE key='vocabulary_version'").get()?.value;
  if (version === '2' && db.prepare('SELECT COUNT(*) AS count FROM vocabulary').get().count === 3000) return;
  db.prepare('DELETE FROM vocabulary').run();
  const responses = await Promise.all(wordLists.map(url => fetch(url)));
  const text = (await Promise.all(responses.map(r => r.text()))).join('\n');
  const words = [...new Set(text.split(/\r?\n/).map(x => x.trim().toLowerCase()).filter(x => /^[a-z][a-z -]{1,28}$/.test(x)))].slice(0, 3000);
  if (words.length < 3000) throw new Error('公开词表未返回足够的有效词条');
  const insert = db.prepare('INSERT OR IGNORE INTO vocabulary(id,word,category) VALUES(?,?,?)');
  db.transaction(() => { words.forEach((word, index) => insert.run(`w_${index + 1}`, word, categories[index % categories.length])); db.prepare("INSERT INTO app_settings(key,value) VALUES('vocabulary_version','2') ON CONFLICT(key) DO UPDATE SET value='2'").run(); })();
}

async function enrich(row) {
  if (row.enriched_at) return row;
  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(row.word)}`);
  if (!response.ok) return row;
  const entry = (await response.json())[0];
  const meaning = entry.meanings?.[0];
  const definition = meaning?.definitions?.[0];
  if (!definition?.definition) return row;
  const example = definition.example || meaning.definitions.find(x => x.example)?.example || `${row.word} is used in everyday English.`;
  const feynman = `把 “${row.word}” 想成：${definition.definition}。先在脑中画出这个意思，再用例句把它说出来。`;
  db.prepare('UPDATE vocabulary SET meaning=?, phonetic=?, pos=?, example_en=?, example_zh=?, feynman=?, native_tip=?, enriched_at=? WHERE id=?').run(
    definition.definition, entry.phonetic || entry.phonetics?.find(x => x.text)?.text || '',
    meaning.partOfSpeech || '', example, '英文例句请结合上下文理解。',
    feynman, `该词在词典中的首要词性是 ${meaning.partOfSpeech || '常用表达'}。`, new Date().toISOString(), row.id);
  return db.prepare('SELECT * FROM vocabulary WHERE id=?').get(row.id);
}

await ensureVocabulary();
app.get('/', (_, res) => res.json({ service: 'Lumina English API', status: 'ok' }));
app.get('/api/health', (_, res) => res.json({ ok: true, vocabulary: db.prepare('SELECT COUNT(*) AS count FROM vocabulary').get().count }));
app.get('/api/vocabulary', (req, res) => {
  const category = req.query.category || 'all';
  res.json(db.prepare('SELECT id,word,category FROM vocabulary WHERE (?="all" OR category=?) ORDER BY id').all(category, category));
});
app.get('/api/vocabulary/:id', async (req, res) => {
  const row = db.prepare('SELECT * FROM vocabulary WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Word not found' });
  try { res.json(await enrich(row)); } catch { res.json(row); }
});
app.get('/api/users/:userId/wordbook', (req,res) => res.json(db.prepare('SELECT v.*,u.created_at,u.reviewed_at FROM user_words u JOIN vocabulary v ON v.id=u.word_id WHERE u.user_id=? ORDER BY u.created_at DESC').all(req.params.userId)));
app.post('/api/users/:userId/wordbook', (req,res) => { db.prepare('INSERT OR IGNORE INTO user_words VALUES(?,?,?,?)').run(req.params.userId,req.body.wordId,new Date().toISOString(),null); res.status(201).json({ok:true}); });
app.delete('/api/users/:userId/wordbook/:wordId',(req,res)=>{db.prepare('DELETE FROM user_words WHERE user_id=? AND word_id=?').run(req.params.userId,req.params.wordId);res.status(204).end();});
app.put('/api/users/:userId/wordbook/:wordId',(req,res)=>{db.prepare('UPDATE user_words SET reviewed_at=? WHERE user_id=? AND word_id=?').run(new Date().toISOString(),req.params.userId,req.params.wordId);res.json({ok:true});});
app.listen(port, () => console.log(`Lumina API listening on :${port}`));
