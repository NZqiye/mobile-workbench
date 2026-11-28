// Thiings assets are stored locally; stable IDs travel with each date record.
import { thiingsIconAdditions } from "./thiings-icon-additions.js";

export const anniversaryIconGroups = ["中国节日", "亲友纪念", "学业事业", "生活出行", "运动户外", "日常期待"];
export const anniversaryIcons = [
  { id: "new-year", label: "元旦跨年", group: "中国节日", image: "/assets-icons/thiings/leisure/fireworks-show.webp", source: "fireworks-show" },
  { id: "spring-festival", label: "春节拜年", group: "中国节日", image: "/assets-icons/thiings/dates/red-envelope.webp", source: "red-envelope" },
  { id: "lantern-festival", label: "元宵佳节", group: "中国节日", image: "/assets-icons/thiings/dates/tangyuan.webp", source: "tangyuan" },
  { id: "qingming", label: "清明追思", group: "中国节日", image: "/assets-icons/thiings/dates/chrysanthemum.webp", source: "chrysanthemum" },
  { id: "labor-day", label: "五一假日", group: "中国节日", image: "/assets-icons/thiings/dates/picnic-basket.webp", source: "picnic-basket" },
  { id: "children-day", label: "六一童趣", group: "中国节日", image: "/assets-icons/thiings/leisure/balloon.webp", source: "balloon" },
  { id: "teachers-day", label: "教师感恩", group: "中国节日", image: "/assets-icons/thiings/leisure/book.webp", source: "book" },
  { id: "dragon-boat", label: "端午安康", group: "中国节日", image: "/assets-icons/thiings/dates/zongzi.webp", source: "zongzi" },
  { id: "qixi", label: "七夕相伴", group: "中国节日", image: "/assets-icons/thiings/dates/heart.webp", source: "heart" },
  { id: "mid-autumn", label: "中秋团圆", group: "中国节日", image: "/assets-icons/thiings/dates/mooncake.webp", source: "mooncake" },
  { id: "national-day", label: "国庆佳节", group: "中国节日", image: "/assets-icons/thiings/dates/china-flag.webp", source: "china-flag" },
  { id: "double-ninth", label: "重阳敬老", group: "中国节日", image: "/assets-icons/thiings/dates/chrysanthemum.webp", source: "chrysanthemum" },
  { id: "winter-solstice", label: "冬至团聚", group: "中国节日", image: "/assets-icons/thiings/dates/dumplings.webp", source: "dumplings" },
  { id: "lanterns", label: "花灯灯会", group: "中国节日", image: "/assets-icons/thiings/dates/paper-lantern.webp", source: "paper-lantern" },
  { id: "wedding", label: "婚礼领证", group: "亲友纪念", image: "/assets-icons/thiings/dates/wedding-rings.webp", source: "wedding-rings" },
  { id: "birthday", label: "生日庆祝", group: "亲友纪念", image: "/assets-icons/thiings/dates/birthday-cake.webp", source: "birthday-cake" },
  { id: "love", label: "恋爱相识", group: "亲友纪念", image: "/assets-icons/thiings/dates/heart.webp", source: "heart" },
  { id: "flowers", label: "鲜花纪念", group: "亲友纪念", image: "/assets-icons/thiings/dates/bridal-bouquet.webp", source: "bridal-bouquet" },
  { id: "memorial", label: "葬礼追思", group: "亲友纪念", image: "/assets-icons/thiings/home/candle.webp", source: "candle" },
  { id: "promotion", label: "升职晋升", group: "学业事业", image: "/assets-icons/thiings/sport/trophy.webp", source: "trophy" },
  { id: "work", label: "入职周年", group: "学业事业", image: "/assets-icons/thiings/finance/briefcase.webp", source: "briefcase" },
  { id: "defense", label: "论文答辩", group: "学业事业", image: "/assets-icons/thiings/dates/diploma.webp", source: "diploma" },
  { id: "graduation", label: "毕业典礼", group: "学业事业", image: "/assets-icons/thiings/dates/graduation-cap.webp", source: "graduation-cap" },
  { id: "exam", label: "考试上岸", group: "学业事业", image: "/assets-icons/thiings/leisure/book.webp", source: "book" },
  { id: "travel", label: "旅行出发", group: "生活出行", image: "/assets-icons/thiings/sport/airplane.webp", source: "airplane" },
  { id: "moving", label: "搬家乔迁", group: "生活出行", image: "/assets-icons/thiings/home/house.webp", source: "house" },
  { id: "show", label: "演出观影", group: "生活出行", image: "/assets-icons/thiings/leisure/ticket-4xjdbi.webp", source: "ticket-4xjdbi" },
  { id: "hiking", label: "徒步", group: "运动户外", image: "/assets-icons/thiings/dates/hiking-on-trails.webp", source: "hiking-on-trails" },
  { id: "climbing", label: "爬山", group: "运动户外", image: "/assets-icons/thiings/outdoor/mountain.webp", source: "mountain" },
  { id: "swimming", label: "游泳", group: "运动户外", image: "/assets-icons/thiings/sport/swimming.webp", source: "swimming" },
  { id: "cycling", label: "骑行", group: "运动户外", image: "/assets-icons/thiings/sport/bicycle.webp", source: "bicycle" },
  { id: "running", label: "跑步", group: "运动户外", image: "/assets-icons/thiings/sport/running.webp", source: "running" },
  { id: "badminton", label: "羽毛球", group: "运动户外", image: "/assets-icons/thiings/sport/badminton-racket.webp", source: "badminton-racket" },
  { id: "camping", label: "露营出游", group: "运动户外", image: "/assets-icons/thiings/sport/camping-tent.webp", source: "camping-tent" },
  { id: "picnic", label: "野餐踏青", group: "运动户外", image: "/assets-icons/thiings/dates/picnic-basket.webp", source: "picnic-basket" },
  { id: "countdown", label: "重要倒数", group: "日常期待", image: "/assets-icons/thiings/dates/hourglass.webp", source: "hourglass" },
  { id: "festival", label: "节日庆祝", group: "日常期待", image: "/assets-icons/thiings/leisure/party-popper.webp", source: "party-popper" },
  { id: "gift", label: "礼物惊喜", group: "日常期待", image: "/assets-icons/thiings/dates/gift.webp", source: "gift" },
  { id: "date", label: "特别日子", group: "日常期待", image: "/assets-icons/thiings/dates/calendar.webp", source: "calendar" },
  ...thiingsIconAdditions.map((icon) => ({
    id: icon.slug === "payroll-check" ? "payday" : `extra-${icon.slug}`,
    label: icon.label,
    group: ["dragon-boat", "chinese-dragon-dance-head", "chinese-knot", "chinese-new-year-candy-box", "fish-shaped-lantern", "mooncake-mold", "apple-for-the-teacher", "new-years-ball"].includes(icon.slug) ? "中国节日"
      : ["valentines-card", "valentines-day", "mothers-day"].includes(icon.slug) ? "亲友纪念"
      : { finance: "学业事业", leisure: "日常期待", sport: "运动户外", outdoor: "运动户外" }[icon.category] || "生活出行",
    image: icon.image,
    source: icon.slug,
  })).filter((icon) => !["food", "home"].includes(thiingsIconAdditions.find((entry) => entry.slug === icon.source)?.category)),
];

export function anniversaryIcon(item) {
  const selected = anniversaryIcons.find((icon) => icon.id === item.icon);
  if (selected) return selected;
  if (item.type === "festival") {
    const holiday = [
      [/元旦|跨年/, "new-year"], [/春节|除夕|过年/, "spring-festival"], [/元宵/, "lantern-festival"],
      [/清明/, "qingming"], [/端午/, "dragon-boat"], [/七夕/, "qixi"], [/中秋/, "mid-autumn"],
      [/劳动节|五一/, "labor-day"], [/儿童节|六一/, "children-day"], [/教师节/, "teachers-day"],
      [/国庆/, "national-day"], [/重阳/, "double-ninth"], [/冬至/, "winter-solstice"],
      [/情人节/, "extra-valentines-day"], [/母亲节/, "extra-mothers-day"],
      [/圣诞/, "extra-christmas-tree"], [/万圣/, "extra-jack-o-lantern"],
      [/感恩节/, "extra-thanksgiving-table"], [/复活节/, "extra-easter-bunny"],
    ].find(([pattern]) => pattern.test(item.title || ""));
    if (holiday) return anniversaryIcons.find((icon) => icon.id === holiday[1]);
  }
  if (/发薪|工资|薪水/.test(item.title || "")) return anniversaryIcons.find((icon) => icon.id === "payday");
  const fallback = { countdown: "countdown", birthday: "birthday", memory: "wedding", festival: "festival" }[item.type || "memory"] || "date";
  return anniversaryIcons.find((icon) => icon.id === fallback);
}
