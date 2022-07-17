// Copyright 2019 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef CHROME_BROWSER_UI_INTENT_PICKER_TAB_HELPER_H_
#define CHROME_BROWSER_UI_INTENT_PICKER_TAB_HELPER_H_

#include <vector>

#include "base/callback_forward.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/weak_ptr.h"
#include "base/scoped_observation.h"
#include "chrome/browser/apps/intent_helper/apps_navigation_types.h"
#include "chrome/browser/web_applications/web_app_install_manager.h"
#include "chrome/browser/web_applications/web_app_install_manager_observer.h"
#include "chrome/browser/web_applications/web_app_registrar.h"
#include "components/services/app_service/public/cpp/icon_types.h"
#include "components/services/app_service/public/mojom/types.mojom-forward.h"
#include "content/public/browser/web_contents_observer.h"
#include "content/public/browser/web_contents_user_data.h"
#include "ui/base/models/image_model.h"
#include "url/origin.h"

// Controls the visibility of IntentPickerView by updating the visibility based
// on stored state. This class is instantiated for both web apps and SWAs.
class IntentPickerTabHelper
    : public content::WebContentsObserver,
      public content::WebContentsUserData<IntentPickerTabHelper>,
      public web_app::WebAppInstallManagerObserver {
 public:
  IntentPickerTabHelper(const IntentPickerTabHelper&) = delete;
  IntentPickerTabHelper& operator=(const IntentPickerTabHelper&) = delete;

  ~IntentPickerTabHelper() override;

  // Shows or hides the intent picker icon for |web_contents|. Always shows a
  // generic picker icon, even if ShowIconForApps() had previously applied
  // app-specific customizations.
  static void ShowOrHideIcon(content::WebContents* web_contents,
                             bool should_show_icon);

  // Shows or hides the intent picker icon for this tab a list of |apps| which
  // can handle a link intent.
  void ShowIconForApps(const std::vector<apps::IntentPickerAppInfo>& apps);

  bool should_show_icon() const { return should_show_icon_; }

  bool should_show_collapsed_chip() const {
    return should_show_collapsed_chip_;
  }

  const ui::ImageModel& app_icon() const { return app_icon_; }

  using IntentPickerIconLoaderCallback =
      base::OnceCallback<void(std::vector<apps::IntentPickerAppInfo> apps)>;

  // Load multiple app icons from App Service.
  static void LoadAppIcons(content::WebContents* web_contents,
                           std::vector<apps::IntentPickerAppInfo> apps,
                           IntentPickerIconLoaderCallback callback);

  // Sets a OnceClosure callback which will be called next time the icon is
  // updated.
  void SetIconUpdateCallbackForTesting(base::OnceClosure callback);

  WEB_CONTENTS_USER_DATA_KEY_DECL();

 private:
  explicit IntentPickerTabHelper(content::WebContents* web_contents);
  friend class content::WebContentsUserData<IntentPickerTabHelper>;

  void OnAppIconLoaded(std::vector<apps::IntentPickerAppInfo> apps,
                       IntentPickerIconLoaderCallback callback,
                       size_t index,
                       apps::IconValuePtr icon_value);

  void LoadAppIcon(std::vector<apps::IntentPickerAppInfo> apps,
                   IntentPickerIconLoaderCallback callback,
                   size_t index);

  void UpdateCollapsedState(bool should_show_icon);
  void OnAppIconLoadedForChip(const std::string& app_id,
                              apps::IconValuePtr icon);
  // Shows or hides the intent icon, with customizations specific to link intent
  // handling.
  void ShowIconForLinkIntent(bool should_show_icon);
  void ShowOrHideIconInternal(bool should_show_icon);

  // content::WebContentsObserver:
  void DidFinishNavigation(
      content::NavigationHandle* navigation_handle) override;

  // web_app::WebAppInstallManagerObserver:
  void OnWebAppWillBeUninstalled(const web_app::AppId& app_id) override;
  void OnWebAppInstallManagerDestroyed() override;

  const raw_ptr<web_app::WebAppRegistrar> registrar_;
  const raw_ptr<web_app::WebAppInstallManager> install_manager_;

  bool should_show_icon_ = false;
  url::Origin last_shown_origin_;
  bool should_show_collapsed_chip_ = false;

  std::string last_shown_app_id_;
  ui::ImageModel app_icon_;

  base::OnceClosure icon_update_closure_;

  base::ScopedObservation<web_app::WebAppInstallManager,
                          web_app::WebAppInstallManagerObserver>
      install_manager_observation_{this};

  base::WeakPtrFactory<IntentPickerTabHelper> weak_factory_{this};
};

#endif  // CHROME_BROWSER_UI_INTENT_PICKER_TAB_HELPER_H_
