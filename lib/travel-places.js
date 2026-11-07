import { travelIconImage } from "./travel-icons";

// Personal check-in shortcuts, not a live popularity ranking or review feed.
export const travelCities = [
  { name: "北京", icon: "beijing-china", iconNote: "城市图标", places: ["故宫博物院", "八达岭长城", "天坛公园", "颐和园"] },
  { name: "上海", icon: "shanghai-china", iconNote: "城市图标", places: ["外滩", "东方明珠", "武康路", "上海迪士尼乐园"] },
  { name: "南昌", icon: "nanchang-china", iconNote: "城市图标", places: ["滕王阁", "八一广场", "万寿宫历史文化街区"] },
  { name: "南京", icon: "porcelain-tower-of-nanjing", iconNote: "大报恩寺琉璃塔地标", places: ["夫子庙秦淮风光带", "中山陵", "南京博物院", "大报恩寺遗址公园"] },
  { name: "西安", icon: "terracotta-warrior", iconNote: "兵马俑地标", places: ["秦始皇帝陵博物院（兵马俑）", "大唐不夜城", "西安城墙", "大雁塔"] },
  { name: "拉萨", icon: "potala-palace", iconNote: "布达拉宫地标", places: ["布达拉宫", "大昭寺", "八廓街"] },
  { name: "成都", icon: "giant-panda", iconNote: "熊猫代表图案", places: ["成都大熊猫繁育研究基地", "宽窄巷子", "锦里", "都江堰景区"] },
  { name: "重庆", icon: "skyline", iconNote: "通用城市图案", places: ["洪崖洞", "李子坝", "解放碑", "长江索道"] },
  { name: "杭州", icon: "alpine-lake", iconNote: "通用湖泊图案", places: ["西湖", "灵隐寺", "西溪国家湿地公园", "京杭大运河杭州段"] },
  { name: "苏州", icon: "zen-garden", iconNote: "通用园林图案", places: ["拙政园", "平江路", "山塘街", "苏州博物馆"] },
  { name: "广州", icon: "skyline", iconNote: "通用城市图案", places: ["广州塔", "沙面", "永庆坊", "陈家祠"] },
  { name: "深圳", icon: "skyline", iconNote: "通用城市图案", places: ["深圳湾公园", "大梅沙海滨公园", "甘坑古镇", "世界之窗"] },
  { name: "武汉", icon: "pagoda", iconNote: "通用古塔图案", places: ["黄鹤楼", "东湖", "湖北省博物馆", "江汉路步行街"] },
  { name: "长沙", icon: "mountain", iconNote: "通用山水图案", places: ["橘子洲", "岳麓山", "湖南博物院", "太平老街"] },
  { name: "厦门", icon: "island", iconNote: "通用海岛图案", places: ["鼓浪屿", "环岛路", "沙坡尾", "厦门园林植物园"] },
  { name: "青岛", icon: "beach", iconNote: "通用海滩图案", places: ["栈桥", "八大关", "崂山", "小麦岛"] },
  { name: "无锡", icon: "zen-garden", iconNote: "通用园林图案", places: ["鼋头渚", "惠山古镇", "南长街", "灵山胜境"] },
  { name: "香港", icon: "hong-kong", iconNote: "城市图标", places: ["维多利亚港", "太平山顶", "香港迪士尼乐园"] },
  { name: "东京", icon: "tokyo-japan", iconNote: "城市图标", places: ["东京塔", "浅草寺", "涩谷", "新宿御苑"] },
  { name: "京都", icon: "kiyomizu-dera", iconNote: "清水寺地标", places: ["清水寺", "伏见稻荷大社", "岚山"] },
  { name: "巴黎", icon: "paris-france", iconNote: "城市图标", places: ["埃菲尔铁塔", "卢浮宫", "凯旋门"] },
  { name: "伦敦", icon: "london-england", iconNote: "城市图标", places: ["大本钟", "伦敦塔桥", "大英博物馆"] },
  { name: "悉尼", icon: "sydney-australia", iconNote: "城市图标", places: ["悉尼歌剧院", "悉尼海港大桥", "邦迪海滩"] },
  { name: "柏林", icon: "berlin-germany", iconNote: "城市图标", places: ["勃兰登堡门", "博物馆岛"] },
  { name: "布拉格", icon: "prague-czech-republic", iconNote: "城市图标", places: ["查理大桥", "布拉格城堡", "老城广场"] },
  { name: "马德里", icon: "madrid-spain", iconNote: "城市图标", places: ["马德里王宫", "普拉多博物馆"] },
  { name: "里约热内卢", icon: "rio-de-janeiro", iconNote: "城市图标", places: ["里约基督像", "科帕卡巴纳海滩"] },
  { name: "芝加哥", icon: "chicago", iconNote: "城市图标", places: ["千禧公园", "海军码头"] },
  { name: "纽约", icon: "statue-of-liberty", iconNote: "自由女神像地标", places: ["自由女神像", "中央公园", "大都会艺术博物馆"] },
  { name: "罗马", icon: "colosseum", iconNote: "斗兽场地标", places: ["罗马斗兽场", "万神殿", "特雷维喷泉"] },
  { name: "巴塞罗那", icon: "sagrada-familia", iconNote: "圣家堂地标", places: ["圣家堂", "古埃尔公园"] },
];

export function travelCityImage(city, icon) {
  const match = travelCities.find((entry) => entry.name === String(city || "").trim());
  return travelIconImage(icon) || travelIconImage(match?.icon) || "/assets-icons/thiings/fashion/suitcase.webp";
}

const placeIcons = [
  [/长城/, "great-wall-of-china"], [/兵马俑/, "terracotta-warrior"], [/布达拉宫/, "potala-palace"],
  [/大报恩寺/, "porcelain-tower-of-nanjing"], [/熊猫/, "giant-panda"], [/珠穆朗玛|珠峰/, "mount-everest"],
  [/日月潭/, "sun-moon-lake"], [/高雄85|85大楼/, "kaohsiung-85-sky-tower"],
  [/埃菲尔|艾菲尔/, "eiffel-tower"], [/大本钟/, "big-ben"], [/伦敦塔桥/, "london-bridge"],
  [/自由女神/, "statue-of-liberty"], [/斗兽场/, "colosseum"], [/比萨斜塔/, "leaning-tower-of-pisa"],
  [/圣家堂|圣家族大教堂/, "sagrada-familia"], [/泰姬陵/, "taj-mahal"], [/吴哥窟/, "angkor-wat"],
  [/富士山/, "mount-fuji"], [/景福宫/, "gyeongbokgung-palace"], [/伏见稻荷/, "fushimi-inari-taisha"], [/清水寺/, "kiyomizu-dera"],
  [/故宫|王宫|宫殿/, "palace"], [/博物|美术馆|艺术馆|卢浮宫/, "museum"],
  [/东方明珠|广州塔|东京塔|电视塔/, "skyline"],
  [/迪士尼|乐园|世界之窗/, "theme-park"], [/摩天轮/, "observation-ferris-wheel"], [/索道|缆车/, "cableway"],
  [/温泉/, "hot-spring"], [/瀑布/, "waterfall"], [/冰川/, "glacier"], [/峡谷/, "canyon"],
  [/盐湖|茶卡/, "salt-flat"], [/沙漠|绿洲/, "desert-oasis"], [/雨林/, "rainforest"], [/森林|松林/, "pine-forest"],
  [/茶园|茶田/, "tea-plantation"], [/火山/, "volcano"], [/海滩|沙滩|海滨|海岸/, "beach"],
  [/灵山胜境/, "pagoda"], [/岛|鼓浪屿|橘子洲/, "island"], [/湖|鼋头渚/, "alpine-lake"], [/山|岭|峰/, "mountain"],
  [/拙政园|颐和园|园林|庭园/, "zen-garden"], [/植物园|花园/, "garden"],
  [/寺|庙|阁|塔|天坛|陈家祠/, "pagoda"],
  [/桥|栈桥/, "bridge-basic-stone-bridge"], [/公园|湿地/, "national-park"],
];

export function travelPlaceImage(city, name, icon) {
  const matched = placeIcons.find(([pattern]) => pattern.test(String(name || "")));
  return travelIconImage(icon) || travelIconImage(matched?.[1]) || travelCityImage(city);
}
