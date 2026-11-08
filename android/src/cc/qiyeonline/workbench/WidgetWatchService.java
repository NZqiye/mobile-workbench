package cc.qiyeonline.workbench;

import android.content.Intent;
import android.graphics.Bitmap;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import org.json.JSONArray;
import org.json.JSONObject;

public final class WidgetWatchService extends RemoteViewsService {
    @Override public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new RemoteViewsFactory() {
            private JSONArray rows = new JSONArray();
            private String today;
            @Override public void onCreate() { onDataSetChanged(); }
            @Override public void onDataSetChanged() { today = WorkbenchWidgets.today(); rows = WorkbenchWidgets.upcoming(WorkbenchWidgets.read(WidgetWatchService.this), today); }
            @Override public void onDestroy() { rows = new JSONArray(); }
            @Override public int getCount() { return rows.length(); }
            @Override public RemoteViews getViewAt(int position) {
                JSONObject row = rows.optJSONObject(position); if (row == null) return null;
                RemoteViews view = new RemoteViews(getPackageName(), R.layout.widget_watch_row);
                String title = row.optString("title"), season = row.optString("season", "1"), episodes = row.optString("episodes");
                view.setTextViewText(R.id.widget_row_title, title);
                view.setTextViewText(R.id.widget_row_meta, "第 " + season + " 季" + (episodes.isEmpty() ? " · 集数待定" : " · " + episodes + " 集") + (row.optString("time").isEmpty() ? "" : " · " + row.optString("time")));
                long remaining = WidgetPolicy.remaining(row.optString("date"), today);
                view.setTextViewText(R.id.widget_row_countdown, remaining == 0 ? "今天" : remaining + " 天");
                view.setTextColor(R.id.widget_row_countdown, remaining == 0 ? 0xFF975B13 : 0xFF6C6386);
                Bitmap poster = WidgetImages.poster(WidgetWatchService.this, row.optString("poster"));
                view.setViewVisibility(R.id.widget_row_poster, poster == null ? View.GONE : View.VISIBLE);
                view.setViewVisibility(R.id.widget_row_placeholder, poster == null ? View.VISIBLE : View.GONE);
                if (poster != null) view.setImageViewBitmap(R.id.widget_row_poster, poster);
                view.setTextViewText(R.id.widget_row_placeholder, title.isEmpty() ? "剧" : title.substring(0, 1));
                view.setOnClickFillInIntent(R.id.widget_row, new Intent());
                return view;
            }
            @Override public RemoteViews getLoadingView() { return null; }
            @Override public int getViewTypeCount() { return 1; }
            @Override public long getItemId(int position) { JSONObject row = rows.optJSONObject(position); return row == null ? position : row.optString("id").hashCode(); }
            @Override public boolean hasStableIds() { return true; }
        };
    }
}
