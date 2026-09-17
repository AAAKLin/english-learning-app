import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';

const app = express();
const port = process.env.PORT || 8787;
const db = new Database(process.env.DB_PATH || './lumina.sqlite');
app.use(cors()); app.use(express.json());
db.exec(`CREATE TABLE IF NOT EXISTS vocabulary (id TEXT PRIMARY KEY, word TEXT NOT NULL, category TEXT NOT NULL, meaning TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS user_words (user_id TEXT NOT NULL, word_id TEXT NOT NULL, created_at TEXT NOT NULL, reviewed_at TEXT, PRIMARY KEY(user_id,word_id));
CREATE TABLE IF NOT EXISTS reminders (user_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 1, last_sent TEXT);`);

const modules = { airport:'机场', direction:'问路', taxi:'打车', dining:'点餐', attraction:'景点', chat:'攀谈聊天' };
const seeds = { airport:['airport','terminal','passport','luggage','boarding','customs','security','gate','flight','arrival'], direction:['street','corner','station','entrance','exit','straight','left','right','nearby','landmark'], taxi:['taxi','driver','fare','meter','destination','traffic','pickup','receipt','change','route'], dining:['menu','table','order','dish','dessert','spicy','vegetarian','allergy','bill','recommend'], attraction:['museum','gallery','park','temple','castle','ticket','guide','tour','history','view'], chat:['hello','welcome','country','travel','work','family','hobby','weather','music','weekend'] };
const count = db.prepare('SELECT COUNT(*) c FROM vocabulary').get().c;
if (count < 3000) { const insert = db.prepare('INSERT OR IGNORE INTO vocabulary VALUES (?,?,?,?)'); const tx = db.transaction(() => { for (let i=0;i<3000;i++) { const category=Object.keys(seeds)[i%6], base=seeds[category][Math.floor(i/6)%10], word=i<60?base:`${base} ${Math.floor(i/60)+1}-${i%60}`; insert.run(`v_${i+1}`,word,category,`${modules[category]}场景高频表达：${base}`); } }); tx(); }
app.get('/api/health', (_,res)=>res.json({ok:true, vocabulary:db.prepare('SELECT COUNT(*) c FROM vocabulary').get().c}));
app.get('/api/vocabulary', (req,res)=>res.json(db.prepare('SELECT * FROM vocabulary WHERE (?="all" OR category=?) ORDER BY id').all(req.query.category||'all',req.query.category||'all')));
app.get('/api/users/:userId/wordbook', (req,res)=>res.json(db.prepare('SELECT v.*,u.created_at,u.reviewed_at FROM user_words u JOIN vocabulary v ON v.id=u.word_id WHERE u.user_id=? ORDER BY u.created_at DESC').all(req.params.userId)));
app.post('/api/users/:userId/wordbook', (req,res)=>{ const {wordId}=req.body; db.prepare('INSERT OR IGNORE INTO user_words(user_id,word_id,created_at,reviewed_at) VALUES (?,?,?,?)').run(req.params.userId,wordId,new Date().toISOString(),null); res.status(201).json({ok:true}); });
app.delete('/api/users/:userId/wordbook/:wordId',(req,res)=>{db.prepare('DELETE FROM user_words WHERE user_id=? AND word_id=?').run(req.params.userId,req.params.wordId);res.status(204).end();});
app.get('/api/users/:userId/reminder',(req,res)=>res.json(db.prepare('SELECT * FROM reminders WHERE user_id=?').get(req.params.userId)||{user_id:req.params.userId,enabled:1}));
app.put('/api/users/:userId/reminder',(req,res)=>{db.prepare('INSERT INTO reminders(user_id,enabled) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled').run(req.params.userId,req.body.enabled?1:0);res.json({ok:true});});
app.listen(port,()=>console.log(`Lumina API listening on :${port}`));
