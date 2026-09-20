import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';

const app = express();
const db = new Database(process.env.DB_PATH || './lumina.sqlite');
const port = process.env.PORT || 8787;
app.use(cors()); app.use(express.json());
db.exec(`CREATE TABLE IF NOT EXISTS vocabulary (
  id TEXT PRIMARY KEY, word TEXT UNIQUE NOT NULL, category TEXT NOT NULL,
  meaning TEXT NOT NULL, phonetic TEXT, pos TEXT, example_en TEXT NOT NULL,
  example_zh TEXT NOT NULL, feynman TEXT NOT NULL, native_tip TEXT
);
CREATE TABLE IF NOT EXISTS user_words (
  user_id TEXT NOT NULL, word_id TEXT NOT NULL, created_at TEXT NOT NULL,
  reviewed_at TEXT, PRIMARY KEY(user_id, word_id)
);
CREATE TABLE IF NOT EXISTS reminders (
  user_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 1, last_sent TEXT
);
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);

// 内置生活场景词库：15 个模块 × 20 个核心对象 × 10 个真实动作 = 3000 个不重复学习短语。
const scenes = {
  airport: ['机场', 'airport', [['passport','护照'],['boarding pass','登机牌'],['luggage','行李'],['departure gate','登机口'],['flight number','航班号'],['security check','安检'],['customs form','海关申报单'],['baggage claim','行李提取处'],['transfer desk','转机柜台'],['flight delay','航班延误'],['window seat','靠窗座位'],['aisle seat','靠过道座位'],['carry-on bag','随身行李'],['check-in counter','值机柜台'],['airport lounge','机场休息室'],['arrival hall','到达大厅'],['terminal map','航站楼地图'],['lost luggage','丢失行李'],['boarding time','登机时间'],['travel document','旅行证件']]],
  directions: ['问路', 'street', [['street corner','街角'],['bus stop','公交站'],['subway entrance','地铁入口'],['traffic light','红绿灯'],['main road','主路'],['city map','城市地图'],['train station','火车站'],['pedestrian crossing','人行横道'],['nearby pharmacy','附近药店'],['public restroom','公共洗手间'],['museum entrance','博物馆入口'],['hotel address','酒店地址'],['next intersection','下一个路口'],['taxi stand','出租车站'],['bridge crossing','过桥路口'],['shopping mall','购物中心'],['tourist office','游客中心'],['bike lane','自行车道'],['parking area','停车区'],['walking route','步行路线']]],
  taxi: ['打车', 'taxi', [['taxi driver','出租车司机'],['pickup point','上车点'],['drop-off point','下车点'],['taxi fare','车费'],['taxi meter','计价器'],['destination address','目的地地址'],['traffic jam','交通堵塞'],['payment method','支付方式'],['ride receipt','乘车收据'],['car trunk','汽车后备箱'],['seat belt','安全带'],['fast route','最快路线'],['safe route','安全路线'],['morning ride','早晨行程'],['night ride','夜间行程'],['taxi app','打车应用'],['cash payment','现金付款'],['card payment','刷卡付款'],['driver rating','司机评分'],['waiting time','等候时间']]],
  dining: ['点餐', 'restaurant', [['restaurant menu','餐厅菜单'],['table reservation','订座'],['main course','主菜'],['vegetarian dish','素食菜品'],['spicy food','辣的食物'],['food allergy','食物过敏'],['drinking water','饮用水'],['coffee order','咖啡订单'],['dessert menu','甜品菜单'],['service charge','服务费'],['restaurant bill','餐厅账单'],['takeaway box','打包盒'],['table number','桌号'],['daily special','每日特餐'],['fresh salad','新鲜沙拉'],['extra napkin','额外餐巾'],['fork and knife','刀叉'],['waiting list','等位名单'],['food recommendation','菜品推荐'],['cooking style','烹饪方式']]],
  attraction: ['景点', 'attraction', [['museum ticket','博物馆门票'],['guided tour','导览团'],['opening time','开放时间'],['closing time','关闭时间'],['city museum','城市博物馆'],['art gallery','艺术画廊'],['historic building','历史建筑'],['public park','公共公园'],['viewpoint ticket','观景台门票'],['tourist map','旅游地图'],['photo spot','拍照点'],['audio guide','语音导览'],['exhibition hall','展厅'],['local market','当地市场'],['temple entrance','寺庙入口'],['beach access','海滩入口'],['walking tour','徒步游览'],['souvenir shop','纪念品店'],['tour schedule','游览日程'],['visitor center','游客中心']]],
  chat: ['攀谈聊天', 'conversation', [['your name','名字'],['home country','祖国'],['travel plan','旅行计划'],['weekend plan','周末计划'],['favorite food','最喜欢的食物'],['local weather','当地天气'],['work experience','工作经历'],['English practice','英语练习'],['family member','家庭成员'],['free time','空闲时间'],['music taste','音乐品味'],['movie choice','电影选择'],['hometown story','家乡故事'],['travel advice','旅行建议'],['phone number','电话号码'],['social media','社交媒体'],['common hobby','共同爱好'],['daily routine','日常习惯'],['polite question','礼貌问题'],['friendly greeting','友好问候']]],
  hotel: ['酒店', 'hotel', [['hotel reservation','酒店预订'],['room key','房间钥匙'],['check-in time','入住时间'],['check-out time','退房时间'],['hotel lobby','酒店大堂'],['breakfast service','早餐服务'],['wifi password','无线网密码'],['room number','房间号'],['extra towel','额外毛巾'],['quiet room','安静房间'],['air conditioning','空调'],['hotel elevator','酒店电梯'],['luggage storage','行李寄存'],['front desk','前台'],['room service','客房服务'],['wake-up call','叫醒服务'],['hotel address','酒店地址'],['key card','房卡'],['late checkout','延迟退房'],['nearby hotel','附近酒店']]],
  shopping: ['购物', 'shop', [['shopping list','购物清单'],['sale price','折扣价'],['fitting room','试衣间'],['cash register','收银台'],['credit card','信用卡'],['return policy','退货政策'],['receipt copy','收据副本'],['gift box','礼品盒'],['clothing size','衣服尺码'],['color choice','颜色选择'],['store entrance','商店入口'],['product label','商品标签'],['shopping bag','购物袋'],['discount code','折扣码'],['customer service','客服'],['out-of-stock item','缺货商品'],['exchange request','换货请求'],['price tag','价格标签'],['online order','线上订单'],['delivery address','配送地址']]],
  emergency: ['紧急情况', 'emergency', [['emergency number','紧急电话'],['police station','警察局'],['ambulance service','救护车服务'],['lost passport','丢失护照'],['stolen wallet','被盗钱包'],['medical emergency','医疗紧急情况'],['fire exit','消防出口'],['safety report','安全报告'],['emergency contact','紧急联系人'],['dangerous area','危险区域'],['help desk','求助台'],['lost child','走失儿童'],['accident scene','事故现场'],['urgent message','紧急消息'],['safety instruction','安全指示'],['emergency room','急诊室'],['local police','当地警察'],['emergency kit','急救包'],['phone battery','手机电量'],['safe place','安全地点']]],
  health: ['医疗', 'medical', [['doctor appointment','医生预约'],['medical clinic','诊所'],['health insurance','医疗保险'],['prescription medicine','处方药'],['medicine dosage','药物剂量'],['allergy information','过敏信息'],['body temperature','体温'],['stomach pain','胃痛'],['headache medicine','头痛药'],['pharmacy counter','药房柜台'],['medical record','医疗记录'],['blood pressure','血压'],['emergency doctor','急诊医生'],['health problem','健康问题'],['pain level','疼痛程度'],['medical advice','医疗建议'],['rest time','休息时间'],['hospital address','医院地址'],['dental clinic','牙科诊所'],['health check','健康检查']]],
  transport: ['公共交通', 'transport', [['bus ticket','公交车票'],['train platform','火车站台'],['subway card','地铁卡'],['transport schedule','交通时刻表'],['train delay','火车延误'],['bus route','公交线路'],['window seat','靠窗座位'],['transport map','交通地图'],['next stop','下一站'],['transfer station','换乘站'],['train carriage','火车车厢'],['ticket machine','售票机'],['public transport','公共交通'],['last train','末班车'],['bus driver','公交司机'],['station exit','车站出口'],['train seat','火车座位'],['transport pass','交通通票'],['route change','路线变更'],['arrival time','到达时间']]],
  payment: ['支付与银行', 'bank', [['bank account','银行账户'],['cash withdrawal','取现'],['exchange rate','汇率'],['bank card','银行卡'],['payment receipt','付款收据'],['account balance','账户余额'],['mobile payment','手机支付'],['bank transfer','银行转账'],['cash machine','取款机'],['currency exchange','货币兑换'],['payment limit','支付限额'],['bank branch','银行网点'],['transaction record','交易记录'],['card password','银行卡密码'],['contactless payment','非接触支付'],['foreign currency','外币'],['bank statement','银行账单'],['service fee','手续费'],['payment problem','支付问题'],['bank opening hours','银行营业时间']]],
  weather: ['天气与网络', 'weather', [['weather forecast','天气预报'],['heavy rain','大雨'],['strong wind','强风'],['sunny day','晴天'],['cold weather','寒冷天气'],['hot weather','炎热天气'],['umbrella shop','雨伞店'],['weather warning','天气预警'],['mobile network','移动网络'],['wifi connection','无线网络连接'],['internet password','网络密码'],['data plan','流量套餐'],['phone signal','手机信号'],['charging cable','充电线'],['power bank','充电宝'],['online map','在线地图'],['network problem','网络问题'],['weather app','天气应用'],['public wifi','公共无线网'],['battery level','电池电量']]],
  work: ['工作与学习', 'work', [['work meeting','工作会议'],['project deadline','项目截止日期'],['email reply','邮件回复'],['office address','办公室地址'],['job interview','工作面试'],['work schedule','工作日程'],['study plan','学习计划'],['classroom number','教室号码'],['homework task','作业任务'],['course material','课程材料'],['teacher question','老师提问'],['team member','团队成员'],['work document','工作文件'],['online meeting','线上会议'],['presentation slide','演示文稿'],['study note','学习笔记'],['training course','培训课程'],['work break','工作休息'],['library card','图书证'],['learning goal','学习目标']]],
  daily: ['日常与邮寄租房', 'daily life', [['rental apartment','租住公寓'],['monthly rent','月租'],['utility bill','水电账单'],['mailbox key','邮箱钥匙'],['post office','邮局'],['package delivery','包裹配送'],['shipping address','邮寄地址'],['daily supplies','日常用品'],['grocery store','杂货店'],['laundry service','洗衣服务'],['cleaning product','清洁用品'],['house key','房门钥匙'],['repair request','维修请求'],['neighbor contact','邻居联系方式'],['rental contract','租房合同'],['moving date','搬家日期'],['postage stamp','邮票'],['delivery time','送达时间'],['household item','家居用品'],['daily expense','日常开销']]]
};
const actions = [['check','查看'],['find','寻找'],['ask about','询问'],['confirm','确认'],['use','使用'],['prepare','准备'],['change','更改'],['report','报告'],['pay for','支付'],['keep','保留']];

function buildVocabulary() {
  const rows = [];
  for (const [category, [categoryZh, place, terms]] of Object.entries(scenes)) {
    for (const [term, termZh] of terms) for (const [action, actionZh] of actions) {
      const word = `${action} ${term} at ${place}`;
      const id = `${category}-${action.replace(/ /g,'-')}-${term.replace(/ /g,'-')}`;
      rows.push({ id, word, category, meaning: `${categoryZh}场景：${actionZh}${termZh}`,
        example_en: `Please ${action} the ${term} before you continue.`,
        example_zh: `继续之前，请${actionZh}${termZh}。`,
        feynman: `想象你正身处${categoryZh}场景，需要先${actionZh}${termZh}才能继续下一步；把这个画面和 “${word}” 连在一起。`,
        native_tip: `在${categoryZh}场景中，这是一条清晰、礼貌的行动表达。` });
    }
  }
  return rows;
}
const vocabulary = buildVocabulary();
if (vocabulary.length !== 3000 || new Set(vocabulary.map(x => x.word)).size !== 3000) throw new Error('内置词库校验失败');
function seedDatabase() {
  const version = db.prepare("SELECT value FROM app_settings WHERE key='vocabulary_version'").get()?.value;
  const count = db.prepare('SELECT COUNT(*) AS count FROM vocabulary').get().count;
  if (version === 'local-3000-v1' && count === 3000) return;
  db.prepare('DELETE FROM vocabulary').run();
  const insert = db.prepare("INSERT INTO vocabulary(id,word,category,meaning,phonetic,pos,example_en,example_zh,feynman,native_tip) VALUES (@id,@word,@category,@meaning,'','实用表达',@example_en,@example_zh,@feynman,@native_tip)");
  db.transaction(() => {
    vocabulary.forEach(row => insert.run(row));
    db.prepare("INSERT INTO app_settings(key,value) VALUES('vocabulary_version','local-3000-v1') ON CONFLICT(key) DO UPDATE SET value='local-3000-v1'").run();
  })();
}
seedDatabase();

app.get('/', (_,res) => res.json({ service:'Lumina English API', status:'ok', vocabulary:3000 }));
app.get('/api/health', (_,res) => res.json({ ok:true, vocabulary:db.prepare('SELECT COUNT(*) AS count FROM vocabulary').get().count }));
app.get('/api/vocabulary', (req,res) => { const category=req.query.category||'all'; res.json(db.prepare('SELECT * FROM vocabulary WHERE (?="all" OR category=?) ORDER BY id').all(category,category)); });
app.get('/api/vocabulary/:id', (req,res) => { const row=db.prepare('SELECT * FROM vocabulary WHERE id=?').get(req.params.id); row ? res.json(row) : res.status(404).json({error:'Word not found'}); });
app.get('/api/users/:userId/wordbook', (req,res) => res.json(db.prepare('SELECT v.*,u.created_at,u.reviewed_at FROM user_words u JOIN vocabulary v ON v.id=u.word_id WHERE u.user_id=? ORDER BY u.created_at DESC').all(req.params.userId)));
app.post('/api/users/:userId/wordbook', (req,res) => { db.prepare('INSERT OR IGNORE INTO user_words VALUES(?,?,?,?)').run(req.params.userId,req.body.wordId,new Date().toISOString(),null); res.status(201).json({ok:true}); });
app.delete('/api/users/:userId/wordbook/:wordId',(req,res)=>{db.prepare('DELETE FROM user_words WHERE user_id=? AND word_id=?').run(req.params.userId,req.params.wordId);res.status(204).end();});
app.put('/api/users/:userId/wordbook/:wordId',(req,res)=>{db.prepare('UPDATE user_words SET reviewed_at=? WHERE user_id=? AND word_id=?').run(new Date().toISOString(),req.params.userId,req.params.wordId);res.json({ok:true});});
app.listen(port, () => console.log(`Lumina API listening on :${port}`));
