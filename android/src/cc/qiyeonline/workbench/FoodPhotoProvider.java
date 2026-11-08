package cc.qiyeonline.workbench;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

public final class FoodPhotoProvider extends ContentProvider {
    @Override public boolean onCreate() { return true; }
    private File file(Uri uri) throws FileNotFoundException {
        if (!"cc.qiyeonline.workbench.food-photos".equals(uri.getAuthority()) || !"/food.jpg".equals(uri.getPath()) || uri.getQuery() != null) throw new FileNotFoundException();
        return new File(getContext().getCacheDir(), "food-photo.jpg");
    }
    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File image = file(uri);
        if ("r".equals(mode)) return ParcelFileDescriptor.open(image, ParcelFileDescriptor.MODE_READ_ONLY);
        if (!"w".equals(mode) && !"rw".equals(mode) && !"rwt".equals(mode)) throw new FileNotFoundException();
        return ParcelFileDescriptor.open(image, ParcelFileDescriptor.MODE_CREATE | ParcelFileDescriptor.MODE_TRUNCATE | ParcelFileDescriptor.MODE_READ_WRITE);
    }
    @Override public String getType(Uri uri) { return "image/jpeg"; }
    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] arguments, String order) {
        try {
            File image = file(uri);
            String[] columns = projection == null ? new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE } : projection;
            MatrixCursor cursor = new MatrixCursor(columns);
            Object[] values = new Object[columns.length];
            for (int i = 0; i < columns.length; i++) values[i] = OpenableColumns.DISPLAY_NAME.equals(columns[i]) ? "food.jpg" : OpenableColumns.SIZE.equals(columns[i]) ? image.length() : null;
            cursor.addRow(values);
            return cursor;
        } catch (FileNotFoundException error) { return null; }
    }
    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] arguments) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String selection, String[] arguments) { throw new UnsupportedOperationException(); }
}
