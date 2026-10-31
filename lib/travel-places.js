// Personal check-in shortcuts, not a live popularity ranking or review feed.
export const travelCities = [
  { name: "北京", icon: "beijing-china", iconNote: "城市图标", places: ["故宫博物院", "八达岭长城", "天坛公园", "颐和园"] },
  { name: "上海", icon: "shanghai-china", iconNote: "城市图标", places: ["外滩", "东方明珠", "武康路", "上海迪士尼乐园"] },
  { name: "南昌", icon: "nanchang-china", iconNote: "城市图标", places: ["滕王阁", "八一广场", "万寿宫历史文化街区"] },
  { name: "南京", icon: "porcelain-tower-of-nanjing", iconNote: "大报恩寺琉璃塔地标", places: ["夫子庙秦淮风光带", "中山陵", "南京博物院", "大报恩寺遗址公园"] },
  { name: "西安", icon: "terracotta-warrior", iconNote: "兵马俑地标", places: ["秦始皇帝陵博物院（兵马俑）", "大唐不夜城", "西安城墙", "大雁塔"] },
  { name: "拉萨", icon: "potala-palace", iconNote: "布达拉宫地标", places: ["布达拉宫", "大昭寺", "八廓街"] },
  { name: "成都", icon: "giant-panda", iconNote: "熊猫代表图案", places: ["成都大熊猫繁育研究基地", "宽窄巷子", "锦里", "都江堰景区"] },
  { name: "重庆", places: ["洪崖洞", "李子坝", "解放碑", "长江索道"] },
  { name: "杭州", places: ["西湖", "灵隐寺", "西溪国家湿地公园", "京杭大运河杭州段"] },
  { name: "苏州", places: ["拙政园", "平江路", "山塘街", "苏州博物馆"] },
  { name: "广州", places: ["广州塔", "沙面", "永庆坊", "陈家祠"] },
  { name: "深圳", places: ["深圳湾公园", "大梅沙海滨公园", "甘坑古镇", "世界之窗"] },
  { name: "武汉", places: ["黄鹤楼", "东湖", "湖北省博物馆", "江汉路步行街"] },
  { name: "长沙", places: ["橘子洲", "岳麓山", "湖南博物院", "太平老街"] },
  { name: "厦门", places: ["鼓浪屿", "环岛路", "沙坡尾", "厦门园林植物园"] },
  { name: "青岛", places: ["栈桥", "八大关", "崂山", "小麦岛"] },
  { name: "无锡", places: ["鼋头渚", "惠山古镇", "南长街", "灵山胜境"] },
];

export function travelCityImage(city) {
  const match = travelCities.find((entry) => entry.name === city);
  return match?.icon ? `/assets-icons/thiings/travel/${match.icon}.webp` : "/assets-icons/thiings/fashion/suitcase.webp";
}

export function travelPlaceImage(city, name) {
  return String(name || "").includes("长城") ? "/assets-icons/thiings/travel/great-wall-of-china.webp" : travelCityImage(city);
}
