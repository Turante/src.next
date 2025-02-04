// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package org.chromium.chrome.browser.download;

import android.app.Activity;
import android.content.Context;

import androidx.annotation.VisibleForTesting;

import org.chromium.base.annotations.CalledByNative;
import org.chromium.base.annotations.NativeMethods;
import org.chromium.chrome.browser.download.DownloadLaterMetrics.DownloadLaterUiEvent;
import org.chromium.chrome.browser.download.DownloadLocationDialogMetrics.DownloadLocationSuggestionEvent;
import org.chromium.chrome.browser.download.dialogs.DownloadDateTimePickerDialog;
import org.chromium.chrome.browser.download.dialogs.DownloadDateTimePickerDialogImpl;
import org.chromium.chrome.browser.download.dialogs.DownloadDialogUtils;
import org.chromium.chrome.browser.download.dialogs.DownloadLaterDialogChoice;
import org.chromium.chrome.browser.download.dialogs.DownloadLaterDialogController;
import org.chromium.chrome.browser.download.dialogs.DownloadLaterDialogCoordinator;
import org.chromium.chrome.browser.download.dialogs.DownloadLaterDialogProperties;
import org.chromium.chrome.browser.download.dialogs.DownloadLocationDialogController;
import org.chromium.chrome.browser.download.dialogs.DownloadLocationDialogCoordinator;
import org.chromium.chrome.browser.download.interstitial.NewDownloadTab;
import org.chromium.chrome.browser.flags.ChromeFeatureList;
import org.chromium.chrome.browser.preferences.Pref;
import org.chromium.chrome.browser.profiles.Profile;
import org.chromium.components.browser_ui.util.DownloadUtils;
import org.chromium.components.prefs.PrefService;
import org.chromium.components.user_prefs.UserPrefs;
import org.chromium.net.ConnectionType;
import org.chromium.ui.base.WindowAndroid;
import org.chromium.ui.modaldialog.DialogDismissalCause;
import org.chromium.ui.modaldialog.ModalDialogManager;
import org.chromium.ui.modaldialog.ModalDialogManagerHolder;
import org.chromium.ui.modelutil.PropertyModel;

import org.chromium.base.Log;
import android.view.View;
import org.chromium.base.ContextUtils;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.widget.ListView;
import android.content.Context;
import android.widget.ListView;
import android.content.pm.PackageManager;
import android.content.Intent;
import android.content.Context;
import android.content.pm.ResolveInfo;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import android.net.Uri;
import android.text.TextUtils;
import android.content.pm.PackageManager.NameNotFoundException;
import android.content.ActivityNotFoundException;
import android.net.Uri;
import java.io.File;

/**
 * Glues download dialogs UI code and handles the communication to download native backend.
 * When {@link ChromeFeatureList#DOWNLOAD_LATER} is enabled, the following dialogs will be shown in
 * a sequence.
 * Download later dialog ==> (optional) Download date time picker ==> Download location dialog
 * When {@link ChromeFeatureList#DOWNLOAD_LATER} is disabled, only the download location dialog will
 * be shown.
 */
public class DownloadDialogBridge
        implements DownloadLocationDialogController, DownloadLaterDialogController {
    private static final long INVALID_START_TIME = -1;
    private long mNativeDownloadDialogBridge;

    private final DownloadLocationDialogCoordinator mLocationDialog;
    private final DownloadLaterDialogCoordinator mDownloadLaterDialog;

    private Context mContext;
    private ModalDialogManager mModalDialogManager;
    private WindowAndroid mWindowAndroid;
    private long mTotalBytes;
    private @ConnectionType int mConnectionType = ConnectionType.CONNECTION_NONE;
    private @DownloadLocationDialogType int mLocationDialogType;
    private String mSuggestedPath;
    private PrefService mPrefService;

    // Whether the user clicked the edit text to open download location dialog.
    private boolean mEditLocation;

    // Whether to show the edit location text in download later dialog.
    private boolean mShowEditLocation;

    @DownloadLaterDialogChoice
    private int mDownloadLaterChoice = DownloadLaterDialogChoice.DOWNLOAD_NOW;
    private long mDownloadLaterTime = INVALID_START_TIME;

    public DownloadDialogBridge(long nativeDownloadDialogBridge,
            DownloadLaterDialogCoordinator downloadLaterDialog,
            DownloadLocationDialogCoordinator locationDialog) {
        mNativeDownloadDialogBridge = nativeDownloadDialogBridge;
        mDownloadLaterDialog = downloadLaterDialog;
        mLocationDialog = locationDialog;
    }

    @CalledByNative
    private static DownloadDialogBridge create(long nativeDownloadDialogBridge) {
        DownloadLocationDialogCoordinator locationDialog = new DownloadLocationDialogCoordinator();
        DownloadDateTimePickerDialog dateTimePickerDialog = new DownloadDateTimePickerDialogImpl();
        DownloadLaterDialogCoordinator downloadLaterDialog =
                new DownloadLaterDialogCoordinator(dateTimePickerDialog);
        dateTimePickerDialog.initialize(downloadLaterDialog);
        DownloadDialogBridge bridge = new DownloadDialogBridge(
                nativeDownloadDialogBridge, downloadLaterDialog, locationDialog);
        downloadLaterDialog.initialize(bridge);
        locationDialog.initialize(bridge);
        return bridge;
    }

    @CalledByNative
    void destroy() {
        mNativeDownloadDialogBridge = 0;
        mDownloadLaterDialog.destroy();
        mLocationDialog.destroy();
    }

    private boolean downloadWithAdm(WindowAndroid windowAndroid, long totalBytes,
           String suggestedPath, String urlToDownload) {
        Activity activity = (Activity) windowAndroid.getActivity().get();
        // If the activity has gone away, just clean up the native pointer.
        if (activity == null) {
            return false;
        }

        boolean useAdmIfPossible = ContextUtils.getAppSharedPreferences().getBoolean("enable_external_download_manager", false);
        String activeDownloadManagerActivityName = ContextUtils.getAppSharedPreferences().getString("selected_external_download_manager_activity_name", "");
        String activeDownloadManagerPackageName = ContextUtils.getAppSharedPreferences().getString("selected_external_download_manager_package_name", "");

        if (useAdmIfPossible && !TextUtils.isEmpty(activeDownloadManagerPackageName) && !TextUtils.isEmpty(activeDownloadManagerActivityName) && activeDownloadManagerPackageName.equals("com.kiwibrowser.browser") != true
         && !TextUtils.isEmpty(urlToDownload) && (urlToDownload.toLowerCase(Locale.ROOT).startsWith("http:") || urlToDownload.toLowerCase(Locale.ROOT).startsWith("https:") || urlToDownload.toLowerCase(Locale.ROOT).startsWith("magnet:") || urlToDownload.toLowerCase(Locale.ROOT).startsWith("ftp:"))) {
            if (urlToDownload.toLowerCase(Locale.ROOT).contains(".googleusercontent.com/crx"))
                return false;
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(urlToDownload));
//            intent.addCategory("android.intent.category.BROWSABLE");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.setClassName(activeDownloadManagerPackageName, activeDownloadManagerActivityName);

            intent.putExtra("android.intent.extra.TEXT", urlToDownload);

            // ADM
            intent.putExtra("com.android.extra.filename", new File(suggestedPath).getName());

            // MXPlayer
            intent.putExtra("title", new File(suggestedPath).getName());
            intent.putExtra("filename", new File(suggestedPath).getName());

            try {
                Log.i("Kiwi", "[Download] Starting activity intent [" + activeDownloadManagerPackageName + "/" + activeDownloadManagerActivityName + "]");
                activity.startActivity(intent);
                return true;
            } catch (ActivityNotFoundException exception) {
                Log.i("Kiwi", "[Download] Starting activity intent: ActivityNotFoundException");
            }
        }
        return false;
    }

    @CalledByNative
    private void showDialog(WindowAndroid windowAndroid, long totalBytes,
            @ConnectionType int connectionType, @DownloadLocationDialogType int dialogType,
            String suggestedPath, boolean supportsLaterDialog, boolean isIncognito) {
        mWindowAndroid = windowAndroid;
        Activity activity = windowAndroid.getActivity().get();
        if (activity == null) {
            onCancel();
            return;
        }
        if (downloadWithAdm(windowAndroid, totalBytes, suggestedPath, urlToDownload)) {
            onCancel();
            return;
        }


        DownloadDirectoryProvider.getInstance().getAllDirectoriesOptions((dirs) -> {
            mShowEditLocation = (dirs != null && dirs.size() > 1);
            ModalDialogManager modalDialogManager =
                    ((ModalDialogManagerHolder) activity).getModalDialogManager();

            // Suggests an alternative download location.
            @DownloadLocationDialogType
            int suggestedDialogType = dialogType;
            if (ChromeFeatureList.isEnabled(ChromeFeatureList.SMART_SUGGESTION_FOR_LARGE_DOWNLOADS)
                    && DownloadDialogUtils.shouldSuggestDownloadLocation(
                            dirs, getDownloadDefaultDirectory(), totalBytes)) {
                suggestedDialogType = DownloadLocationDialogType.LOCATION_SUGGESTION;
                DownloadLocationDialogMetrics.recordDownloadLocationSuggestionEvent(
                        DownloadLocationSuggestionEvent.LOCATION_SUGGESTION_SHOWN);
            }

            showDialog(activity, modalDialogManager, getPrefService(), totalBytes, connectionType,
                    suggestedDialogType, suggestedPath, supportsLaterDialog, isIncognito);
        });
    }

    @VisibleForTesting
    void showDialog(Context context, ModalDialogManager modalDialogManager, PrefService prefService,
            long totalBytes, @ConnectionType int connectionType,
            @DownloadLocationDialogType int dialogType, String suggestedPath,
            boolean supportsLaterDialog, boolean isIncognito) {
        mContext = context;
        mModalDialogManager = modalDialogManager;
        mPrefService = prefService;

        mTotalBytes = totalBytes;
        mConnectionType = connectionType;
        mLocationDialogType = dialogType;
        mSuggestedPath = suggestedPath;

        mDownloadLaterChoice = DownloadLaterDialogChoice.DOWNLOAD_NOW;
        mDownloadLaterTime = INVALID_START_TIME;

        // Download later dialogs flow only when the network is cellular, where supportsLaterDialog
        // is true.
        if (ChromeFeatureList.isEnabled(ChromeFeatureList.DOWNLOAD_LATER) && supportsLaterDialog) {
            showDownloadLaterDialog();
            return;
        }

        mLocationDialog.showDialog(
                mContext, mModalDialogManager, totalBytes, dialogType, suggestedPath, isIncognito);
    }

    private void onComplete() {
        if (mNativeDownloadDialogBridge == 0) return;

        boolean onlyOnWifi = (mDownloadLaterChoice == DownloadLaterDialogChoice.ON_WIFI);
        DownloadDialogBridgeJni.get().onComplete(mNativeDownloadDialogBridge,
                DownloadDialogBridge.this, mSuggestedPath, onlyOnWifi, mDownloadLaterTime);
    }

    private void onCancel() {
        if (mNativeDownloadDialogBridge == 0) return;
        DownloadDialogBridgeJni.get().onCanceled(
                mNativeDownloadDialogBridge, DownloadDialogBridge.this);
        if (mWindowAndroid != null) {
            NewDownloadTab.closeExistingNewDownloadTab(mWindowAndroid);
            mWindowAndroid = null;
        }
    }

    // DownloadLaterDialogController implementation.
    @Override
    public void onDownloadLaterDialogComplete(
            @DownloadLaterDialogChoice int choice, long startTime) {
        mDownloadLaterChoice = choice;
        mDownloadLaterTime = startTime;

        DownloadLaterMetrics.recordDownloadLaterDialogChoice(choice, mTotalBytes);

        // When there is no error message, skip the location dialog.
        if (mLocationDialogType == DownloadLocationDialogType.DEFAULT) {
            onComplete();
            return;
        }

        // The location dialog has error message text, show the location dialog after the download
        // later dialog. isIncognito is false because DownloadLater is not available in Incognito.
        showLocationDialog(false /*editLocation*/, false /* isIncognito */);
    }

    @Override
    public void onDownloadLaterDialogCanceled() {
        DownloadLaterMetrics.recordDownloadLaterUiEvent(
                DownloadLaterUiEvent.DOWNLOAD_LATER_DIALOG_CANCEL);
        onCancel();
    }

    @Override
    public void onEditLocationClicked() {
        DownloadLaterMetrics.recordDownloadLaterUiEvent(
                DownloadLaterUiEvent.DOWNLOAD_LATER_DIALOG_EDIT_CLICKED);
        mDownloadLaterDialog.dismissDialog(DialogDismissalCause.ACTION_ON_CONTENT);

        // The user clicked the edit location text. isIncognito is false because DownloadLater is
        // not available in Incognito.
        showLocationDialog(true /* editLocation */, false /* isIncognito */);
    }

    private void showLocationDialog(boolean editLocation, boolean isIncognito) {
        mEditLocation = editLocation;

        mDownloadLaterChoice = mDownloadLaterDialog.getChoice();

        mLocationDialog.showDialog(mContext, mModalDialogManager, mTotalBytes, mLocationDialogType,
                mSuggestedPath, isIncognito);
    }

    private void showDownloadLaterDialog() {
        assert mPrefService != null;
        @DownloadLaterPromptStatus
        int promptStatus = mPrefService.getInteger(Pref.DOWNLOAD_LATER_PROMPT_STATUS);
        PropertyModel.Builder builder =
                new PropertyModel.Builder(DownloadLaterDialogProperties.ALL_KEYS)
                        .with(DownloadLaterDialogProperties.CONTROLLER, mDownloadLaterDialog)
                        .with(DownloadLaterDialogProperties.INITIAL_CHOICE, mDownloadLaterChoice)
                        .with(DownloadLaterDialogProperties.DONT_SHOW_AGAIN_SELECTION, promptStatus)
                        .with(DownloadLaterDialogProperties.SUBTITLE_TEXT,
                                getDownloadLaterDialogSubtitle())
                        .with(DownloadLaterDialogProperties.SHOW_DATE_TIME_PICKER_OPTION,
                                DownloadDialogBridgeJni.get().shouldShowDateTimePicker());
        if (mShowEditLocation) {
            builder.with(DownloadLaterDialogProperties.LOCATION_TEXT,
                    mContext.getResources().getString(R.string.menu_downloads));
        }

        mDownloadLaterDialog.showDialog(
                mContext, mModalDialogManager, mPrefService, builder.build());
        DownloadLaterMetrics.recordDownloadLaterUiEvent(
                DownloadLaterUiEvent.DOWNLOAD_LATER_DIALOG_SHOW);
    }

    private String getDownloadLaterDialogSubtitle() {
        if (mConnectionType == ConnectionType.CONNECTION_2G) {
            return mContext.getResources().getString(R.string.download_later_slow_network_subtitle,
                    mContext.getResources().getString(R.string.download_later_2g_connection));
        }
        if (mConnectionType == ConnectionType.CONNECTION_BLUETOOTH) {
            return mContext.getResources().getString(R.string.download_later_slow_network_subtitle,
                    mContext.getResources().getString(
                            R.string.download_later_bluetooth_connection));
        }

        if (mTotalBytes >= DownloadDialogBridgeJni.get().getDownloadLaterMinFileSize()) {
            return mContext.getResources().getString(R.string.download_later_large_file_subtitle,
                    DownloadUtils.getStringForBytes(mContext, mTotalBytes));
        }

        return "";
    }

    // DownloadLocationDialogController implementation.
    @Override
    public void onDownloadLocationDialogComplete(String returnedPath) {
        mSuggestedPath = returnedPath;

        if (mLocationDialogType == DownloadLocationDialogType.LOCATION_SUGGESTION) {
            boolean isSelected = !mSuggestedPath.equals(getDownloadDefaultDirectory());
            DownloadLocationDialogMetrics.recordDownloadLocationSuggestionChoice(isSelected);
        }

        // The location dialog is triggered automatically, complete the flow.
        if (!mEditLocation) {
            onComplete();
            return;
        }

        // The location dialog is triggered by the "Edit" text. Show the download later dialog
        // again.
        mEditLocation = false;
        showDownloadLaterDialog();
    }

    @Override
    public void onDownloadLocationDialogCanceled() {
        if (!mEditLocation) {
            onCancel();
            return;
        }

        // The location dialog is triggered by the "Edit" text. Show the download later dialog
        // again.
        mEditLocation = false;
        showDownloadLaterDialog();
    }

    void setPrefServiceForTesting(PrefService prefService) {
        mPrefService = prefService;
    }

    /**
     * @return The stored download default directory.
     */
    public static String getDownloadDefaultDirectory() {
        return DownloadDialogBridgeJni.get().getDownloadDefaultDirectory();
    }

    /**
     * @param directory New directory to set as the download default directory.
     */
    public static void setDownloadAndSaveFileDefaultDirectory(String directory) {
        DownloadDialogBridgeJni.get().setDownloadAndSaveFileDefaultDirectory(directory);
    }

    /**
     * @return The status of prompt for download pref, defined by {@link DownloadPromptStatus}.
     */
    @DownloadPromptStatus
    public static int getPromptForDownloadAndroid() {
        return getPrefService().getInteger(Pref.PROMPT_FOR_DOWNLOAD_ANDROID);
    }

    /**
     * @param status New status to update the prompt for download preference.
     */
    public static void setPromptForDownloadAndroid(@DownloadPromptStatus int status) {
        getPrefService().setInteger(Pref.PROMPT_FOR_DOWNLOAD_ANDROID, status);
    }

    /**
     * @return The value for {@link Pref#PROMPT_FOR_DOWNLOAD}. This is currently only used by
     * enterprise policy.
     */
    public static boolean getPromptForDownloadPolicy() {
        return getPrefService().getBoolean(Pref.PROMPT_FOR_DOWNLOAD);
    }

    /**
     * @return whether to prompt the download location dialog is controlled by enterprise policy.
     */
    public static boolean isLocationDialogManaged() {
        return DownloadDialogBridgeJni.get().isLocationDialogManaged();
    }

    public static boolean shouldShowDateTimePicker() {
        return DownloadDialogBridgeJni.get().shouldShowDateTimePicker();
    }

    private static PrefService getPrefService() {
        return UserPrefs.get(Profile.getLastUsedRegularProfile());
    }

    @NativeMethods
    public interface Natives {
        void onComplete(long nativeDownloadDialogBridge, DownloadDialogBridge caller,
                String returnedPath, boolean onWifi, long startTime);
        void onCanceled(long nativeDownloadDialogBridge, DownloadDialogBridge caller);
        String getDownloadDefaultDirectory();
        void setDownloadAndSaveFileDefaultDirectory(String directory);
        long getDownloadLaterMinFileSize();
        boolean shouldShowDateTimePicker();
        boolean isLocationDialogManaged();
    }
}
