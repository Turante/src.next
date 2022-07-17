// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef CONTENT_BROWSER_GPU_GPU_INTERNALS_UI_H_
#define CONTENT_BROWSER_GPU_GPU_INTERNALS_UI_H_

#include "content/common/content_export.h"
#include "content/public/browser/web_ui_controller.h"
#include "content/public/browser/webui_config.h"

namespace content {

class GpuInternalsUIConfig : public WebUIConfig {
 public:
  GpuInternalsUIConfig();

  // WebUIConfig
  std::unique_ptr<WebUIController> CreateWebUIController(
      WebUI* web_ui) override;
};

class GpuInternalsUI : public WebUIController {
 public:
  explicit GpuInternalsUI(WebUI* web_ui);

  GpuInternalsUI(const GpuInternalsUI&) = delete;
  GpuInternalsUI& operator=(const GpuInternalsUI&) = delete;
};

}  // namespace content

#endif  // CONTENT_BROWSER_GPU_GPU_INTERNALS_UI_H_
