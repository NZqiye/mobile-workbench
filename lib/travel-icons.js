// Thiings catalog 066f16a0db0e, checked 2026-11-07. All images are served locally.
export const travelIconGroups = [
  { label: "中国地标", icons: [
    ["beijing-china", "北京城市"], ["shanghai-china", "上海城市"], ["nanchang-china", "南昌城市"],
    ["great-wall-of-china", "长城"], ["porcelain-tower-of-nanjing", "大报恩寺琉璃塔"],
    ["terracotta-warrior", "兵马俑"], ["potala-palace", "布达拉宫"], ["giant-panda", "熊猫"],
    ["hong-kong", "香港城市"], ["mount-everest", "珠穆朗玛峰"], ["sun-moon-lake", "日月潭"], ["kaohsiung-85-sky-tower", "高雄85大楼"],
  ] },
  { label: "世界城市与地标", icons: [
    ["tokyo-japan", "东京城市"], ["paris-france", "巴黎城市"], ["london-england", "伦敦城市"],
    ["sydney-australia", "悉尼城市"], ["berlin-germany", "柏林城市"], ["prague-czech-republic", "布拉格城市"],
    ["madrid-spain", "马德里城市"], ["rio-de-janeiro", "里约城市"], ["chicago", "芝加哥城市"],
    ["eiffel-tower", "埃菲尔铁塔"], ["big-ben", "大本钟"], ["london-bridge", "伦敦塔桥"],
    ["statue-of-liberty", "自由女神像"], ["colosseum", "罗马斗兽场"], ["leaning-tower-of-pisa", "比萨斜塔"],
    ["sagrada-familia", "圣家堂"], ["taj-mahal", "泰姬陵"], ["angkor-wat", "吴哥窟"],
    ["mount-fuji", "富士山"], ["gyeongbokgung-palace", "景福宫"], ["fushimi-inari-taisha", "伏见稻荷大社"], ["kiyomizu-dera", "清水寺"],
  ] },
  { label: "山水自然", icons: [
    ["mountain", "山峦"], ["alpine-lake", "山间湖泊"], ["waterfall", "瀑布"], ["beach", "海滩"],
    ["island", "海岛"], ["pine-forest", "松林"], ["rainforest", "雨林"], ["canyon", "峡谷"],
    ["glacier", "冰川"], ["salt-flat", "盐湖地貌"], ["desert-oasis", "沙漠绿洲"], ["hot-spring", "温泉"],
    ["national-park", "自然公园"], ["garden", "花园"], ["tea-plantation", "茶园"], ["volcano", "火山"],
  ] },
  { label: "古建与城市景点", icons: [
    ["pagoda", "古塔"], ["temple", "古典庙宇"], ["palace", "宫殿"], ["museum", "博物馆"],
    ["bridge-basic-stone-bridge", "石桥"], ["lantern-festival-bridge", "灯会桥梁"], ["zen-garden", "园林"],
    ["theme-park", "主题乐园"], ["observation-ferris-wheel", "摩天轮"], ["skyline", "城市天际线"],
    ["ancient-temple", "古寺遗址"], ["hanging-cliff-monastery", "悬崖寺院"],
  ] },
  { label: "地图与出行", icons: [
    ["location", "定位标记"], ["map-pin", "地图图钉"], ["world-map", "世界地图"],
    ["topographic-map", "地形地图"], ["compass", "指南针"], ["airplane", "飞机"],
    ["train", "火车"], ["sailboat", "帆船"], ["cableway", "缆车"], ["tourist-transport", "观光交通"],
  ] },
];

export const travelIcons = travelIconGroups.flatMap((group) => group.icons.map(([id, label]) => ({ id, label, group: group.label })));

export function travelIconImage(id) {
  return travelIcons.some((icon) => icon.id === id) ? `/assets-icons/thiings/travel/${id}.webp` : "";
}
