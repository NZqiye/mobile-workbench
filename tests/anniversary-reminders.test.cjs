const test = require('node:test');
const assert = require('node:assert/strict');

test('solar anniversaries repeat across year boundaries while countdowns and dated holidays stay fixed', async () => {
  const { anniversaryDates } = await import('../lib/anniversary-dates.js');
  assert.deepEqual(anniversaryDates({ date: '2000-01-01', type: 'birthday' }, '2026-12-31'), ['2026-01-01', '2027-01-01', '2028-01-01']);
  assert.deepEqual(anniversaryDates({ date: '2026-12-01', type: 'countdown' }, '2027-01-01'), ['2026-12-01']);
  assert.deepEqual(anniversaryDates({ id: 'holiday-2026-x', date: '2026-12-01' }, '2027-01-01'), ['2026-12-01']);
  for (const date of ['bad', '2026-02-30', '2026-13-01']) assert.deepEqual(anniversaryDates({ date }, '2026-11-26'), []);
});

test('lunar birthdays use actual Chinese calendar dates, including the lunar year crossing January', async () => {
  const { anniversaryDates, beijingDateKey } = await import('../lib/anniversary-dates.js');
  assert.equal(anniversaryDates({ date: '2000-01-01', calendarType: 'lunar' }, '2026-01-01')[1], '2026-02-17');
  assert.equal(anniversaryDates({ date: '2000-08-15', calendarType: 'lunar' }, '2026-11-26')[0], '2026-09-25');
  assert.equal(beijingDateKey(Date.parse('2026-11-25T16:01Z')), '2026-11-26');
});

test('all four reminder types have stable IDs, Beijing times and no private notes', async () => {
  const { nativeReminderSchedule } = await import('../lib/native-reminders.js');
  const now = Date.parse('2026-11-26T00:00:00+08:00');
  const source = {
    plans: [{ id: 'task', title: '待办', reminderAt: '2026-11-27T08:00', note: 'private' }, { id: 'done', title: '完成', status: '已完成', reminderAt: '2026-11-27T08:00' }],
    consultations: [
      { id: 'show', title: '追剧', season: 2, airTime: '21:30', episodeSchedule: [1, 2, 2, 3, 4, 5, 6].map(episode => ({ date: '2026-11-27', episode })) },
      { id: 'duplicate', tmdbId: 42, title: '去重', nextAirDate: '2026-11-27', updateEpisodes: '7' },
      { id: 'same', tmdbId: 42, title: '去重', nextAirDate: '2026-11-27', updateEpisodes: '8' },
      { id: 'stopped', title: '不提醒', status: '暂停/弃剧', nextAirDate: '2026-11-27' },
    ],
    anniversaries: [{ id: 'birthday', title: '生日', date: '2000-11-27', type: 'birthday', note: 'private' }],
    subscriptionRecords: [{ id: 'sub', title: '订阅', endDate: '2026-11-29', purchaseType: '订阅会员' }, { id: 'permanent', title: '永久', endDate: '2026-11-29', purchaseType: '永久会员' }],
  };
  const schedule = nativeReminderSchedule(source, now);
  assert.deepEqual([...new Set(schedule.map(item => item.kind))].sort(), ['anniversaries', 'subscriptions', 'tasks', 'watch']);
  const show = schedule.find(item => item.id.startsWith('watch:show:'));
  assert.equal(show.at, Date.parse('2026-11-27T21:30:00+08:00'));
  assert.match(show.title, /第2季 第1、2、3、4、5、6集/);
  assert.equal(schedule.filter(item => item.id.startsWith('watch:tmdb-tv-42')).length, 1);
  assert.match(schedule.find(item => item.id.startsWith('watch:tmdb-tv-42')).title, /7、8/);
  assert.equal(schedule.find(item => item.id === 'anniversary:birthday:2026-11-27:1').at, Date.parse('2026-11-26T09:00:00+08:00'));
  assert.equal(schedule.find(item => item.id === 'subscription:sub:2026-11-29:3').at, Date.parse('2026-11-26T09:00:00+08:00'));
  assert.equal(JSON.stringify(schedule).includes('private'), false);
  assert.equal(JSON.stringify(schedule).includes('不提醒'), false);
  assert.deepEqual(nativeReminderSchedule({}, now), []);
  assert.equal(schedule.some(item => item.id === 'done'), false);
});

test('reminders omit records over a day late and calculate phone recharge estimates', async () => {
  const { nativeReminderSchedule } = await import('../lib/native-reminders.js');
  const now = Date.parse('2026-11-26T10:00:00+08:00');
  const schedule = nativeReminderSchedule({
    plans: [{ id: 'old', title: '过去', reminderAt: '2026-11-24T10:00' }],
    subscriptionRecords: [{ id: 'phone', title: '手机话费', purchaseType: '手机话费', purchaseDate: '2026-11-01', billingDay: 29, price: 100, balance: 0 }],
  }, now);
  assert.equal(schedule.some(item => item.id === 'old'), false);
  assert.equal(schedule.filter(item => item.kind === 'subscriptions').length, 2);
  assert.match(schedule[0].title, /按当前余额估算/);
});

test('anniversary card snapshot shares target dates but not original years or private notes', async () => {
  const { widgetSnapshot } = await import('../lib/native-widgets.js');
  const snapshot = widgetSnapshot([], [], 2000, '2026-11-26', [], [], {}, [{ id: 'ann', title: '纪念日', date: '2000-11-27', note: 'private' }]);
  assert.equal(snapshot.anniversaryDetails[0].dates[0], '2026-11-27');
  assert.equal(snapshot.anniversaryDetails[0].annual, true);
  assert.match(snapshot.anniversaryDetails[0].icon, /^\/assets-icons\/thiings\/.+\.webp$/);
  assert.ok(snapshot.anniversaryDetails[0].hints.today);
  assert.equal(JSON.stringify(snapshot).includes('private'), false);
  assert.equal(JSON.stringify(snapshot).includes('2000'), true);
  assert.equal(JSON.stringify(snapshot.anniversaryDetails).includes('2000'), false);
});

test('anniversary hints match the occasion and proximity and travel with notifications', async () => {
  const { anniversaryMessage } = await import('../lib/anniversary-messages.js');
  const { nativeReminderSchedule } = await import('../lib/native-reminders.js');
  assert.match(anniversaryMessage({ type: 'birthday' }, 0), /生日快乐/);
  assert.match(anniversaryMessage({ title: '恋爱纪念日' }, 1), /浪漫|彼此/);
  assert.match(anniversaryMessage({ title: '研究生考试' }, 1), /证件|休息/);
  assert.match(anniversaryMessage({ icon: 'exam', title: '重要一天' }, 3), /专注/);
  assert.match(anniversaryMessage({ title: '旅行出发' }, 1), /行李/);
  assert.match(anniversaryMessage({ icon: 'travel' }, 0), /出发/);
  assert.match(anniversaryMessage({ title: '入职周年' }, 0), /努力/);
  assert.match(anniversaryMessage({ type: 'festival' }, 1), /节日/);
  assert.match(anniversaryMessage({ title: '发薪日' }, 0), /核对到账/);
  assert.match(anniversaryMessage({ icon: 'payday' }, 1), /账单/);
  assert.match(anniversaryMessage({ icon: 'extra-valentines-day' }, 1), /浪漫|彼此/);
  assert.notEqual(anniversaryMessage({ type: 'birthday' }, 1), anniversaryMessage({ type: 'birthday' }, 0));
  assert.notEqual(anniversaryMessage({ icon: 'travel' }, 1), anniversaryMessage({ icon: 'travel' }, 100));
  const schedule = nativeReminderSchedule({ anniversaries: [{ id: 'exam', title: '考试', type: 'countdown', date: '2026-11-28' }] }, Date.parse('2026-11-27T00:00:00+08:00'));
  assert.match(schedule.find(item => item.id.endsWith(':1')).title, /明天.*2026-11-28.*\n.*证件/);
  assert.match(schedule.find(item => item.id.endsWith(':0')).title, /今天.*\n.*稳住节奏/);
});
