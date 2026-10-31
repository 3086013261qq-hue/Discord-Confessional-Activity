"""Compile frozen card prose and explicit effect payloads; manifest remains pool truth."""
import re,json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
blocks={}
for prefix in ('003','004','005'):
 text=next((root/'docs').glob(prefix+'*')).read_text()
 for m in re.finditer(r'^## ([HP]-[A-Z]+-\d+)｜.*?\n(.*?)(?=^## [HP]-|^# [34]\.|\Z)',text,re.M|re.S):
  body=m[2];quote=re.search(r'^> [“"](.+?)[”"]',body,re.M)
  blocks[m[1]]={'quote':quote[1] if quote else '', 'description':body.strip(),'actions':[]}
def setc(id,h=0,n=None,r=None,t=None,i=None):
 b=blocks[id]
 for kind,value in [('nickname',n),('role',r),('token',t)]:
  if value:b['actions'].append({'kind':kind,'value':value,'hours':h})
 if i:b['interaction']=i
setc('H-TAT-01',6,r='🌪️ 被龙卷罩着');setc('H-TAT-02',3,n='被龙卷勉强认可的');setc('H-TAT-04',24,t='priority_confession');setc('H-TAT-05',4,r='💚 龙卷今天没骂我');setc('H-TAT-06',12,r='🌪️ 风暴保护对象');setc('H-TAT-07',8,n='被龙卷偏爱的',r='💚 风暴偏爱');setc('H-TAT-09',24,t='hell_reroll_token');setc('H-TAT-10',24,r='🌪️ 暴风眼庇护',t='storm_protection')
setc('P-TAT-01',2,r='🌪️ 风暴训诫中');setc('P-TAT-02',2,n='被龙卷打屁股的');setc('P-TAT-03',3,n='被龙卷拎起来训话的');setc('P-TAT-04',2,r='🤐 不许顶嘴');setc('P-TAT-05',2,n='龙卷认证的笨蛋');setc('P-TAT-06',6,n='正在接受龙卷训诫的',r='🌪️ 风暴训诫中');setc('P-TAT-07',6,r='⚠️ 被龙卷警告三次',i='ack3');setc('P-TAT-08',24,r='🌪️ 欠龙卷一次反省');setc('P-TAT-09',8,n='正在被龙卷公开训话的',r='💚 今日反面教材');setc('P-TAT-10',12,n='被暴风眼盯上的',r='🌪️ 暴风眼重点观察')
setc('H-REN-01',4,r='👑 修女长许可');setc('H-REN-02',3,n='山城恋认证的乖孩子');setc('H-REN-03',24,t='priority_confession');setc('H-REN-04',6,r='🌹 得到山城恋表扬');setc('H-REN-05',24,t='command_skip_token');setc('H-REN-06',12,r='👑 修女长的宠儿');setc('H-REN-07',8,n='被山城恋亲自嘉奖的',r='🌹 御前嘉奖');setc('H-REN-09',24,t='judgment_redraw_token');setc('H-REN-10',24,r='👑 王座之侧',t='ren_protection')
setc('P-REN-01',2,r='🖤 今天要听修女长的话');setc('P-REN-02',2,n='正在向山城恋反省的');setc('P-REN-03',2,r='📜 已接受修女长口头命令',i='ack1');setc('P-REN-04',2,n='山城恋认证的笨蛋信徒');setc('P-REN-05',3,r='🕯️ 忏悔室值日生');setc('P-REN-06',6,r='👑 已执行绝对命令',i='command');setc('P-REN-07',6,n='山城恋认证的乖狗狗',r='🐕 修女长认证·乖狗狗');setc('P-REN-08',24,r='📖 山城恋已记账');setc('P-REN-09',8,n='正在御前反省的',r='🌹 御前反省中',i='accept3');setc('P-REN-10',12,n='正在服从山城恋命令的',r='👑 伏首',i='bow')
setc('H-LYB-01',4,r='🎲 庄家放你一马');setc('H-LYB-02',3,n='被李柚巴夸走运的');setc('H-LYB-03',24,t='lucky_chip');setc('H-LYB-04',24,t='free_reroll');setc('H-LYB-05',6,r='🍀 李柚巴的幸运客人');setc('H-LYB-08',8,n='被李柚巴偏爱的',r='♥️ 庄家偏爱');setc('H-LYB-10',24,r='🎰 JACKPOT 幸运儿',t='jackpot_protection')
setc('P-LYB-01',2,n='刚输给李柚巴的');setc('P-LYB-02',6,r='🎲 赌债未清');setc('P-LYB-03',3,n='赌输了还嘴硬的');setc('P-LYB-05',i='round');setc('P-LYB-06',i='double');setc('P-LYB-08',8,n='李柚巴牌桌上的反面教材',r='🃏 今日输家代表');setc('P-LYB-09',8,n='梭哈失败的',r='🎴 全押全输');setc('P-LYB-10',12,n='被李柚巴通吃的',r='🎰 HOUSE WINS',i='house')
manifest=json.loads((root/'public/config/judgement-manifest.v1.json').read_text())
assert set(blocks)=={c['id'] for c in manifest['cards']}
assert all(b['quote'] for b in blocks.values())
(root/'shared/card-details.json').write_text(json.dumps(blocks,ensure_ascii=False,indent=2)+'\n')
print('60 frozen card details compiled')
